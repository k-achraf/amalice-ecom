import { PDFDocument } from 'pdf-lib'
import { StockService } from '../common/stock.service'
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { NormalizedCourierStatus } from './courier-provider.interface'
import { CourierProvider, COURIER_PROVIDER } from './courier-provider.interface'
import {
  VALID_TRANSITIONS,
  courierStatusLabel,
  courierStatusToOrderState,
  normalizeCourierStatus,
  isValidTransition,
  type AddressCheckResult,
  type CourierActivityView,
  type CourierUpdateView,
  type DispatchOrder,
  type OrderCourierLocation,
  type OrderState,
  type SetOrderCourierLocation,
  type ShipmentTrackingView,
  type UpdateDeliveryInfo
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { DhdApiService, type DhdOrderPayload, type DhdParcelUpdate, type DhdTrackingInfo } from '../shipping-companies/dhd-api.service'
import { matchCommune } from '../shipping-companies/address-matching'
import { buildProposal, resolveCourierWilaya, type MapRowLike } from '../shipping-companies/location-map.util'
import { GoogleSheetsService } from '../apps/google-sheets.service'

// Maps the courier's normalized status onto the order lifecycle (plan §7).
// This is the single place that translation happens — COU-04's "one code path
// for admin-changed and courier-told" rule. Both the webhook handler and the
// admin manual-transition path funnel through here for status writes.
// Cleared whenever an order's shipping company changes: the courier location is only valid for the company it was set for.
const CLEAR_COURIER_LOCATION = { courierWilayaId: null, courierCommune: null, courierPostalCode: null, courierLocationCompanyId: null }

const STATUS_TO_ORDER_STATE: Record<NormalizedCourierStatus, string | null> = {
  created: null, // shipment created, but order stays HandedToCourier (set on createShipment)
  picked_up: 'HandedToCourier',
  in_transit: 'HandedToCourier',
  out_for_delivery: 'OutForDelivery',
  delivered: 'Delivered',
  delivery_failed: 'DeliveryFailed',
  returned: 'ReturnedToOrigin',
  // The courier cancelling a shipment only ever happens post-dispatch, i.e.
  // well after call-center confirmation — CancelledShipping (not the
  // pre-confirmation Cancelled) is the correct target. See OrderState's
  // Prisma comment.
  cancelled: 'CancelledShipping'
}

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(COURIER_PROVIDER) private readonly courier: CourierProvider,
    // DHD-specific extras beyond the generic CourierProvider contract
    // (Modifier/Expedier/Télécharger l'étiquette/bulk create/valider les
    // retours — the rest of the "Commandes" API section) go straight to
    // DhdApiService rather than through the courier abstraction, since
    // there's no cross-provider equivalent for them to generalize into.
    private readonly dhd: DhdApiService,
    private readonly googleSheets: GoogleSheetsService,
    private readonly stock: StockService
  ) {}

  // Fire-and-forget, same rule as everywhere else GoogleSheetsService is
  // called: a Sheets outage/misconfiguration must never affect fulfillment.
  // GoogleSheetsService itself already no-ops cheaply when the feature is
  // disabled/unconfigured or the order was never pushed to any sheet.
  private syncShippingInfoToSheets(orderId: string): void {
    this.googleSheets.updateShippingInfo(orderId).catch((error: Error) => {
      this.logger.warn(`Google Sheets shipping-info update failed for order ${orderId}: ${error.message}`)
    })
  }

  // Resolves the shipping company an order was explicitly assigned
  // (assignShippingCompany) — never a "default" company. Every DHD-specific
  // action below (requestPickup/updateShipment/label/bulk/returns) reads the
  // company from the ORDER it's acting on, not a global setting, so two
  // different orders can legitimately go through two different companies.
  private async dhdCompanyForOrder(shippingCompanyId: string | null) {
    if (!shippingCompanyId) {
      throw new BadRequestException('This order has no shipping company assigned — assign one first.')
    }
    const company = await this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
    if (!company) throw new NotFoundException('Assigned shipping company not found.')
    if (!company.isLinked || !company.apiToken) {
      throw new BadRequestException(`${company.name} is not linked — link it under Settings → Shipping Companies.`)
    }
    return { baseUrl: company.baseUrl, apiToken: company.apiToken }
  }

  // Auto-provisions (upserts, never requires manual seeding) the legacy
  // Courier row Shipment.courierId's FK still needs, keyed to the specific
  // company the order was assigned to.
  private async courierRowForCompany(shippingCompanyId: string) {
    const company = await this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
    if (!company) throw new NotFoundException('Assigned shipping company not found.')
    const slug = company.provider.toLowerCase()
    return this.prisma.courier.upsert({
      where: { slug },
      update: { name: company.name },
      create: { slug, name: company.name }
    })
  }

  // Same auto-provisioning, for manual (in-house) deliveries — no shipping
  // company involved at all, but Shipment.courierId still needs a row.
  private async courierRowForManual() {
    return this.prisma.courier.upsert({
      where: { slug: 'manual' },
      update: {},
      create: { slug: 'manual', name: 'Manual delivery' }
    })
  }

  // Assign a specific shipping company to an order — required before
  // createShipmentForOrder (dispatch) will accept it. Deliberately a
  // separate, explicit step: dispatch never silently falls back to
  // whichever company happens to be marked default.
  async assignShippingCompany(orderId: string, shippingCompanyId: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.shipment) throw new BadRequestException('Order is already dispatched — cancel the existing shipment before reassigning.')

    const company = await this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
    if (!company) throw new NotFoundException('Shipping company not found')
    if (!company.isLinked) throw new BadRequestException(`${company.name} is not linked — link it under Settings → Shipping Companies first.`)

    await this.prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentMethod: 'ShippingCompany', shippingCompanyId, ...(order.shippingCompanyId !== shippingCompanyId ? CLEAR_COURIER_LOCATION : {}) }
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { assignedShippingCompany: company.name }
    })
    this.syncShippingInfoToSheets(orderId)

    return { orderId, fulfillmentMethod: 'ShippingCompany' as const, shippingCompanyId, shippingCompanyName: company.name }
  }

  // Assign an order to manual (in-house) delivery instead of a shipping
  // company — our own delivery person, no courier API involved.
  async assignManual(orderId: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.shipment) throw new BadRequestException('Order is already dispatched — cancel the existing shipment before reassigning.')

    await this.prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentMethod: 'Manual', shippingCompanyId: null, ...CLEAR_COURIER_LOCATION }
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { assignedShippingCompany: null, manual: true }
    })
    this.syncShippingInfoToSheets(orderId)

    return { orderId, fulfillmentMethod: 'Manual' as const }
  }

  // The shipping company an address should be checked against: the order's
  // assigned one, else the default/only linked one (so the call center can be
  // warned before any company is assigned).
  private async companyForCheck(shippingCompanyId: string | null) {
    if (shippingCompanyId) return this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
    const linked = await this.prisma.shippingCompany.findMany({ where: { isLinked: true } })
    return linked.find((c) => c.isDefault) ?? (linked.length === 1 ? linked[0]! : null)
  }

  // Checks an order's destination against the courier's own commune list: the
  // wilaya must be served, the commune must exist (we accept an unambiguous
  // near-match and use the courier's spelling), and a stop desk may only be
  // chosen where one exists. Couriers reject anything else at creation time.
  async checkAddress(orderId: string): Promise<AddressCheckResult> {
    return (await this.runAddressCheck(orderId)).result
  }

  // Same as checkAddress, plus the wilaya code to send to the courier (the COURIER's own wilaya id,
  // which differs from ours for wilayas 59-69 and for any mapped location).
  // An order with a courier location saved by an agent for its current company skips fuzzy matching.
  private async runAddressCheck(orderId: string): Promise<{ result: AddressCheckResult; courierWilayaId: string | null }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { address: true } })
    if (!order) throw new NotFoundException('Order not found')
    const company = await this.companyForCheck(order.shippingCompanyId)
    const saved = !!company && order.shippingCompanyId === company.id && order.courierLocationCompanyId === company.id && !!order.courierWilayaId && !!order.courierCommune
    const savedWilaya = saved ? order.courierWilayaId : null
    const base = { shippingCompanyId: company?.id ?? null, shippingCompanyName: company?.name ?? null, matchedCommune: null, postalCode: null, stopDeskAvailable: null, suggestions: [] as string[] }
    const wrap = (result: AddressCheckResult, courierWilayaId: string | null = savedWilaya) => ({ result, courierWilayaId })
    if (!company || !company.isLinked) return wrap({ ...base, checked: false, ok: true, issues: [] })
    if (!company.locationsSyncedAt) return wrap({ ...base, checked: false, ok: true, issues: [`${company.name}: commune list not synced yet — sync it under Shipping companies.`] })

    if (saved) {
      const row = await this.prisma.shippingCompanyCommune.findUnique({
        where: { shippingCompanyId_wilayaId_name: { shippingCompanyId: company.id, wilayaId: order.courierWilayaId!, name: order.courierCommune! } }
      })
      if (!row) {
        return wrap({ ...base, checked: true, ok: false, issues: [`${company.name}: the saved courier location "${order.courierCommune}" (wilaya ${order.courierWilayaId}) is not in its commune list any more — use "Convert location" again.`] })
      }
      const issues: string[] = []
      if (order.shippingType === 'Desk' && !row.hasStopDesk) issues.push(`${company.name} has no stop desk in ${row.name}: switch to home delivery or another commune.`)
      return wrap({ ...base, checked: true, ok: issues.length === 0, issues, matchedCommune: row.name, postalCode: order.courierPostalCode ?? row.postalCode, stopDeskAvailable: row.hasStopDesk })
    }

    const wilaya = await this.prisma.wilaya.findFirst({ where: { name: order.address.region } })
    if (!wilaya) return wrap({ ...base, checked: true, ok: false, issues: [`Unknown wilaya "${order.address.region}".`] })
    const communes = await this.prisma.shippingCompanyCommune.findMany({ where: { shippingCompanyId: company.id, wilayaId: wilaya.id } })
    if (!communes.length) {
      // Our wilayas 59-69 do not exist at couriers still on the old 58-wilaya list: never guess, the agent converts.
      const issue = Number(wilaya.id) >= 59
        ? `${company.name} has no wilaya ${wilaya.id} (${wilaya.name}) in its list: use "Convert location" on this order to pick the courier's wilaya and commune.`
        : `${company.name} does not deliver to ${wilaya.name}.`
      return wrap({ ...base, checked: true, ok: false, issues: [issue] }, wilaya.id)
    }

    const { match, suggestions } = matchCommune(communes.map((c) => ({ name: c.name, postalCode: c.postalCode, hasStopDesk: c.hasStopDesk })), order.address.city)
    if (!match) {
      return wrap({ ...base, checked: true, ok: false, issues: [`${company.name} does not recognise the commune "${order.address.city}" in ${wilaya.name}.`], suggestions }, wilaya.id)
    }
    const issues: string[] = []
    if (order.shippingType === 'Desk' && !match.hasStopDesk) issues.push(`${company.name} has no stop desk in ${match.name}: switch to home delivery or another commune.`)
    return wrap({ ...base, checked: true, ok: issues.length === 0, issues, matchedCommune: match.name, postalCode: match.postalCode, stopDeskAvailable: match.hasStopDesk }, wilaya.id)
  }

  // ---- "Convert location": the courier's own wilaya/commune for one order ----

  private async findWilayaForOrder(region: string) {
    const byName = await this.prisma.wilaya.findFirst({ where: { name: region } })
    return byName ?? (await this.prisma.wilaya.findUnique({ where: { id: region } }))
  }

  async getCourierLocation(orderId: string): Promise<OrderCourierLocation> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { address: true, shippingCompany: true } })
    if (!order) throw new NotFoundException('Order not found')
    const company = order.shippingCompany
    const wilaya = await this.findWilayaForOrder(order.address.region)
    const ourCommune = order.address.city
    const out: OrderCourierLocation = {
      company: company ? { id: company.id, name: company.name, provider: company.provider } : null,
      ourWilaya: { id: wilaya?.id ?? null, name: wilaya?.name ?? order.address.region },
      ourCommune,
      current: null,
      proposal: { courierWilayaId: '', courierCommune: null, courierPostalCode: null, source: 'none' },
      courierWilayaIds: []
    }
    if (!company) return out

    const [wilayaIds, maps] = await Promise.all([
      this.prisma.shippingCompanyCommune.findMany({ where: { shippingCompanyId: company.id }, distinct: ['wilayaId'], select: { wilayaId: true } }),
      wilaya ? this.prisma.shippingCompanyLocationMap.findMany({ where: { shippingCompanyId: company.id, ourWilayaId: wilaya.id, ourCommune: { in: ['', ourCommune] } } }) : Promise.resolve([])
    ])
    out.courierWilayaIds = wilayaIds.map((w) => w.wilayaId).sort((a, b) => Number(a) - Number(b))
    out.current =
      order.courierLocationCompanyId === company.id && order.courierWilayaId && order.courierCommune
        ? { courierWilayaId: order.courierWilayaId, courierCommune: order.courierCommune, courierPostalCode: order.courierPostalCode }
        : null

    const communeRow: MapRowLike | null = ourCommune ? (maps.find((m) => m.ourCommune === ourCommune) ?? null) : null
    const wilayaRow: MapRowLike | null = maps.find((m) => m.ourCommune === '') ?? null
    const target = wilaya ? resolveCourierWilaya(wilaya.id, wilayaRow, communeRow).id : null
    const communes = target ? await this.prisma.shippingCompanyCommune.findMany({ where: { shippingCompanyId: company.id, wilayaId: target }, select: { name: true, postalCode: true, hasStopDesk: true } }) : []
    out.proposal = buildProposal({ ourWilayaId: wilaya?.id ?? null, ourCommune, current: out.current, communeRow, wilayaRow, communesOf: () => communes })
    return out
  }

  async setCourierLocation(orderId: string, input: SetOrderCourierLocation, actor: AuditActor): Promise<OrderCourierLocation> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.shipment) throw new BadRequestException('A shipment already exists for this order — the courier location can no longer be changed.')
    if (order.fulfillmentMethod !== 'ShippingCompany' || !order.shippingCompanyId) throw new BadRequestException('Assign a shipping company to this order first.')
    const company = await this.prisma.shippingCompany.findUnique({ where: { id: order.shippingCompanyId } })
    if (!company) throw new NotFoundException('Assigned shipping company not found.')
    const row = await this.prisma.shippingCompanyCommune.findUnique({
      where: { shippingCompanyId_wilayaId_name: { shippingCompanyId: company.id, wilayaId: input.courierWilayaId, name: input.courierCommune } }
    })
    if (!row) throw new BadRequestException(`"${input.courierCommune}" is not in the commune list of ${company.name} for wilaya ${input.courierWilayaId}.`)
    const courierPostalCode = input.courierPostalCode || row.postalCode
    await this.prisma.order.update({
      where: { id: orderId },
      data: { courierWilayaId: input.courierWilayaId, courierCommune: row.name, courierPostalCode, courierLocationCompanyId: company.id }
    })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { courierLocation: { company: company.name, courierWilayaId: input.courierWilayaId, courierCommune: row.name, courierPostalCode } }
    })
    return this.getCourierLocation(orderId)
  }

  async clearCourierLocation(orderId: string, actor: AuditActor): Promise<OrderCourierLocation> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.shipment) throw new BadRequestException('A shipment already exists for this order — the courier location can no longer be changed.')
    await this.prisma.order.update({ where: { id: orderId }, data: CLEAR_COURIER_LOCATION })
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: orderId, metadata: { courierLocation: null } })
    return this.getCourierLocation(orderId)
  }

  private async shopName(): Promise<string | undefined> {
    const settings = await this.prisma.storeSettings.findFirst({ select: { storeName: true } })
    return settings?.storeName
  }

  private addressErrorMessage(check: AddressCheckResult): string {
    return `Address not accepted by ${check.shippingCompanyName}: ${check.issues.join(' ')}${check.suggestions.length ? ` Did you mean: ${check.suggestions.join(', ')}?` : ''}`
  }

  // COU-03 / "Ajouter une commande" — create the shipment at the shipping
  // company the order was explicitly assigned to (never a default), through its
  // API. The address is checked against the courier's commune list first. On
  // success the order moves to HandedToCourier and the tracking reference is
  // stored; with `confirm` (default) the courier's "Expedier" step is also done
  // right away, after which the parcel can no longer be edited or deleted there.
  async createShipmentForOrder(orderId: string, actor: AuditActor, opts: Partial<DispatchOrder> = {}) {
    // Creating the parcel never confirms it (the courier's "Expedier" step): it stays
    // "Prêt à expédier" there until someone confirms it by hand.
    const confirm = opts.confirm ?? false
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, address: true, shipment: true, items: { include: { product: true } } }
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.state !== 'Packed') {
      throw new BadRequestException(`Order must be Packed to dispatch (currently ${order.state})`)
    }
    if (order.shipment) {
      throw new BadRequestException('Shipment already exists for this order')
    }
    if (order.fulfillmentMethod !== 'ShippingCompany' || !order.shippingCompanyId) {
      throw new BadRequestException(
        order.fulfillmentMethod === 'Manual'
          ? 'This order is assigned to manual delivery — use dispatchManual, not dispatch.'
          : 'Assign a shipping company to this order before dispatching it.'
      )
    }

    const { result: check, courierWilayaId } = await this.runAddressCheck(orderId)
    if (check.checked && !check.ok) throw new BadRequestException(this.addressErrorMessage(check))
    if (order.courierOperation === 'Exchange' && !order.exchangeProduct) {
      throw new BadRequestException('Exchange orders need the product to collect from the customer.')
    }

    const courier = await this.courierRowForCompany(order.shippingCompanyId)

    const result = await this.courier.createShipment({
      orderId: order.id,
      shippingCompanyId: order.shippingCompanyId,
      address: {
        line1: order.address.line1,
        line2: order.address.line2,
        city: order.address.city,
        region: order.address.region,
        postalCode: order.address.postalCode,
        country: order.address.country
      },
      recipientName: order.customer.name,
      recipientPhone: order.customer.phone,
      codAmountCents: order.totalCents,
      stopDesk: order.shippingType === 'Desk',
      items: order.items.map((item) => ({ name: item.product.name, quantity: item.quantity })),
      courierWilayaId: courierWilayaId ?? undefined,
      courierCommune: check.matchedCommune ?? undefined,
      courierPostalCode: check.postalCode ?? undefined,
      notes: order.deliveryNote ?? undefined,
      fragile: order.isFragile,
      gpsLink: order.gpsLink,
      shopName: await this.shopName(),
      operation: order.courierOperation,
      exchangeProduct: order.exchangeProduct
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.create({
        data: {
          orderId: order.id,
          courierId: courier.id,
          trackingReference: result.trackingReference,
          courierStatus: result.courierStatus
        }
      })
      await tx.order.update({ where: { id: orderId }, data: { state: 'HandedToCourier' } })
    })

    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: orderId,
      metadata: { from: 'Packed', to: 'HandedToCourier', trackingReference: result.trackingReference, courier: courier.name, confirm }
    })
    this.syncShippingInfoToSheets(orderId)

    // The parcel exists at the courier even if confirming fails (e.g. a rate
    // limit): report that instead of failing the whole dispatch, so the
    // shipment can be confirmed again with one click.
    let confirmed = false
    let confirmError: string | null = null
    if (confirm) {
      try {
        await this.confirmAtCourier(orderId, result.trackingReference, order.shippingCompanyId, opts.askCollection ?? true, actor)
        confirmed = true
      } catch (error) {
        confirmError = (error as Error).message
        this.logger.warn(`Order ${orderId}: created at the courier but confirming failed: ${confirmError}`)
      }
    }

    return { orderId, trackingReference: result.trackingReference, courierStatus: result.courierStatus, confirmed, confirmError }
  }

  // The courier's "Expedier" step: schedules pickup/transit and locks the
  // parcel against edits/deletion. Records when it happened.
  private async confirmAtCourier(orderId: string, trackingReference: string, shippingCompanyId: string, askCollection: boolean, actor: AuditActor) {
    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(shippingCompanyId)
    await this.dhd.shipOrder(baseUrl, apiToken, trackingReference, askCollection)
    await this.prisma.shipment.update({ where: { orderId }, data: { carrierConfirmedAt: new Date() } })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { dhdAction: 'expedier', trackingReference, askCollection }
    })
  }

  // Manual dispatch — records a shipment WITHOUT calling any shipping
  // company's API, entering the tracking reference by hand instead. Two
  // real cases this covers:
  //  1. fulfillmentMethod = 'Manual' (in-house delivery) — no shipping
  //     company at all, courier row is the auto-provisioned "Manual
  //     delivery" row.
  //  2. fulfillmentMethod = 'ShippingCompany' — staff already arranged the
  //     shipment with that company directly (phone call, the company's own
  //     portal, etc.) instead of through our DHD integration, and just needs
  //     to record it here; the courier row is still the ASSIGNED company's,
  //     so reconciliation attributes it correctly.
  // Either way requires an order already assigned (never Unassigned — see
  // assignShippingCompany/assignManual) and a tracking reference the admin
  // typed in, since there's no API call here to generate one automatically.
  async dispatchManual(orderId: string, trackingReferenceInput: string | undefined, actor: AuditActor) {
    const trackingReference = trackingReferenceInput?.trim() || null
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.state !== 'Packed') {
      throw new BadRequestException(`Order must be Packed to dispatch (currently ${order.state})`)
    }
    if (order.shipment) {
      throw new BadRequestException('Shipment already exists for this order')
    }
    if (order.fulfillmentMethod === 'Unassigned') {
      throw new BadRequestException('Assign a shipping company or manual delivery to this order before dispatching it.')
    }

    const courier = order.fulfillmentMethod === 'ShippingCompany'
      ? await this.courierRowForCompany(order.shippingCompanyId!)
      : await this.courierRowForManual()

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.create({
        data: { orderId: order.id, courierId: courier.id, trackingReference, courierStatus: 'manual_dispatch', carrierConfirmedAt: new Date() }
      })
      await tx.order.update({ where: { id: orderId }, data: { state: 'HandedToCourier' } })
    })

    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: orderId,
      metadata: { from: 'Packed', to: 'HandedToCourier', manual: true, trackingReference, courier: courier.name }
    })
    this.syncShippingInfoToSheets(orderId)

    return { orderId, manual: true, trackingReference }
  }

  // COU-04 — apply a courier status update through the SAME transition logic
  // admin uses. The webhook controller calls this after authenticating;
  // idempotent (re-applying the same status is a no-op). Out-of-order
  // deliveries can't break the state machine — isValidTransition gates it.
  async applyCourierStatus(trackingReference: string, normalizedStatus: NormalizedCourierStatus) {
    // trackingReference is nullable (not @unique), so findFirst not findUnique.
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingReference },
      include: { order: true }
    })
    if (!shipment) {
      this.logger.warn(`Webhook for unknown tracking reference: ${trackingReference}`)
      return { applied: false, reason: 'unknown tracking reference' }
    }

    const targetState = STATUS_TO_ORDER_STATE[normalizedStatus]
    if (!targetState) {
      // 'created'/'picked_up'/'in_transit' map to HandedToCourier — already set.
      return { applied: false, reason: `status ${normalizedStatus} does not advance the order` }
    }

    const from = shipment.order.state
    if (from === targetState) {
      return { applied: false, reason: `order already ${from}` }
    }
    if (!isValidTransition(from as never, targetState as never)) {
      this.logger.warn(
        `Webhook would cause illegal transition ${from} → ${targetState} for order ${shipment.order.id}; ignoring`
      )
      return { applied: false, reason: `illegal transition ${from} → ${targetState}` }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { courierStatus: normalizedStatus }
      })
      await tx.order.update({ where: { id: shipment.order.id }, data: { state: targetState as never } })
    })
    // The courier cancelled before delivery: the parcel never left, give the stock back.
    if (targetState === 'CancelledShipping') await this.stock.releaseForOrder(shipment.order.id)

    await this.audit.log({
      action: 'StateTransition',
      entity: 'Order',
      entityId: shipment.order.id,
      metadata: { from, to: targetState, source: 'courier-webhook', trackingReference }
    })

    return { applied: true, from, to: targetState }
  }

  // "Expedier une commande" — DHD's dispatch/confirm step. A DHD order sits
  // unconfirmed after creation until this is called; it's what actually
  // schedules pickup/transit, separate from createShipmentForOrder
  // registering the order with DHD in the first place. askCollection
  // requests DHD's own pickup from the shop rather than a shop drop-off.
  async requestPickup(orderId: string, askCollection: boolean, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no courier shipment yet — dispatch it first.')
    if (!order.shippingCompanyId) throw new BadRequestException('This order has no shipping company assigned.')
    if (order.shipment.carrierConfirmedAt) throw new BadRequestException('This shipment is already confirmed with the courier.')

    await this.confirmAtCourier(orderId, order.shipment.trackingReference, order.shippingCompanyId, askCollection, actor)
    return { orderId, trackingReference: order.shipment.trackingReference }
  }

  // "Supprimer une commande" — cancels the shipment with DHD (goes through
  // the CourierProvider interface, same as createShipment, so it works
  // regardless of which provider is bound). Manual deliveries just drop the
  // Shipment row — there's no courier API to call. The order itself is
  // reverted to Packed so staff can fix whatever needed changing and
  // re-dispatch, rather than getting stuck in HandedToCourier with a dead
  // shipment reference.
  async cancelShipmentForOrder(orderId: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment) throw new BadRequestException('Order has no shipment to cancel.')

    // A shipment recorded by hand has nothing at the courier to delete.
    const recordedByHand = order.shipment.courierStatus === 'manual_dispatch'
    if (order.fulfillmentMethod === 'ShippingCompany' && !recordedByHand) {
      if (order.shipment.carrierConfirmedAt) {
        throw new BadRequestException('The courier already has this parcel: it can no longer be deleted there. Use "Request return" instead.')
      }
      if (!order.shipment.trackingReference || !order.shippingCompanyId) {
        throw new BadRequestException('Order has no shipping-company tracking reference to cancel.')
      }
      await this.courier.cancelShipment(order.shipment.trackingReference, order.shippingCompanyId)
    }

    const canRevert = isValidTransition(order.state as never, 'Packed' as never)
    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.delete({ where: { id: order.shipment!.id } })
      if (canRevert) await tx.order.update({ where: { id: orderId }, data: { state: 'Packed' } })
    })

    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: orderId,
      metadata: { dhdAction: 'cancel', trackingReference: order.shipment.trackingReference, revertedTo: canRevert ? 'Packed' : null }
    })
    this.syncShippingInfoToSheets(orderId)

    return { orderId, cancelled: true, revertedToPacked: canRevert }
  }

  // "Modifier une commande" — edit address/contact/remark fields on a DHD
  // order that hasn't been picked up yet. Only forwards the subset of
  // fields the caller actually provided; DHD leaves anything omitted
  // unchanged.
  async updateShipmentForOrder(orderId: string, fields: Partial<Pick<DhdOrderPayload, 'nom_client' | 'telephone' | 'telephone_2' | 'adresse' | 'commune' | 'montant' | 'remarque' | 'stop_desk' | 'fragile'>>, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no courier shipment to update.')
    if (order.shipment.carrierConfirmedAt) throw new BadRequestException('The courier already has this parcel: it can no longer be modified there. Add a note for the courier instead.')

    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(order.shippingCompanyId)
    await this.dhd.updateOrder(baseUrl, apiToken, order.shipment.trackingReference, fields)

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { dhdAction: 'update', trackingReference: order.shipment.trackingReference, fields }
    })

    return { orderId, updated: true }
  }

  // "Télécharger l'étiquette" — the label PDF, streamed straight through by
  // the controller (see DhdApiService.getLabel's comment on why this
  // returns raw bytes rather than a parsed shape).
  async getShipmentLabel(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no DHD shipment yet.')

    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(order.shippingCompanyId)
    return this.dhd.getLabel(baseUrl, apiToken, order.shipment.trackingReference)
  }

  // One PDF holding every requested order's courier label. Orders without a
  // parcel (or whose label the courier can't return) are skipped and counted,
  // so one bad order doesn't block the batch.
  async getMergedLabels(orderIds: string[]) {
    const merged = await PDFDocument.create()
    const skipped: string[] = []
    for (const id of orderIds) {
      try {
        const { data } = await this.getShipmentLabel(id)
        const src = await PDFDocument.load(data)
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach((p) => merged.addPage(p))
      } catch {
        skipped.push(id)
      }
    }
    if (!merged.getPageCount()) throw new BadRequestException('None of the selected orders has a label yet — send them to the courier first.')
    return { data: await merged.save(), skipped }
  }

  // "Ajouter plusieurs commandes" — dispatch several Packed orders to their
  // shipping company in one go. Every order in the batch must already be
  // individually assigned to the SAME company (orders assigned elsewhere, or
  // unassigned, are reported back as skipped). Each order's address is checked
  // against the courier's commune list first; the rest are sent in requests of
  // at most 100 (the courier's limit). Results come back per order (partial
  // success is normal): only orders the courier returned a tracking number for
  // get a Shipment row + HandedToCourier. With `confirm`, each created parcel is
  // then also confirmed ("Expedier").
  async bulkDispatch(orderIds: string[], shippingCompanyId: string, actor: AuditActor, opts: { confirm?: boolean; askCollection?: boolean } = {}) {
    const confirm = opts.confirm ?? false
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { customer: true, address: true, shipment: true, items: { include: { product: true } } }
    })

    const isDispatchable = (o: (typeof orders)[number]) =>
      o.state === 'Packed' && !o.shipment && o.fulfillmentMethod === 'ShippingCompany' && o.shippingCompanyId === shippingCompanyId

    const candidates = orders.filter(isDispatchable)
    const skipped = orders
      .filter((o) => !isDispatchable(o))
      .map((o) => ({
        orderId: o.id,
        reason: o.shipment
          ? 'already has a shipment'
          : o.state !== 'Packed'
            ? `not Packed (currently ${o.state})`
            : o.shippingCompanyId !== shippingCompanyId
              ? 'not assigned to this shipping company'
              : 'not assigned to a shipping company'
      }))
    const failed: { orderId: string; reason: string }[] = []
    const dispatched: { orderId: string; trackingReference: string; confirmed: boolean }[] = []
    if (candidates.length === 0) return { dispatched, failed, skipped }

    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(shippingCompanyId)
    const courier = await this.courierRowForCompany(shippingCompanyId)
    const shopName = await this.shopName()

    const wilayaNames = [...new Set(candidates.map((o) => o.address.region))]
    const wilayas = await this.prisma.wilaya.findMany({ where: { name: { in: wilayaNames } } })
    const wilayaCodeByName = new Map(wilayas.map((w) => [w.name, w.id]))

    const ready: { order: (typeof candidates)[number]; payload: DhdOrderPayload }[] = []
    for (const order of candidates) {
      const { result: check, courierWilayaId } = await this.runAddressCheck(order.id)
      if (check.checked && !check.ok) {
        failed.push({ orderId: order.id, reason: this.addressErrorMessage(check) })
        continue
      }
      if (order.courierOperation === 'Exchange' && !order.exchangeProduct) {
        failed.push({ orderId: order.id, reason: 'Exchange orders need the product to collect from the customer.' })
        continue
      }
      ready.push({
        order,
        payload: {
          reference: order.id,
          nom_client: order.customer.name ?? '',
          telephone: order.customer.phone,
          adresse: order.address.line2 ? `${order.address.line1}, ${order.address.line2}` : order.address.line1,
          commune: check.matchedCommune ?? order.address.city,
          code_postal: check.postalCode ?? undefined,
          code_wilaya: courierWilayaId ?? wilayaCodeByName.get(order.address.region) ?? '',
          montant: String(Math.round(order.totalCents / 100)),
          remarque: order.deliveryNote?.slice(0, 255) || undefined,
          produit: order.items.map((i) => i.product.name).join(',') || undefined,
          stock: '0',
          quantite: order.items.map((i) => String(Math.ceil(i.quantity))).join(',') || undefined,
          produit_a_recuperer: order.courierOperation === 'Exchange' ? (order.exchangeProduct ?? undefined) : undefined,
          boutique: shopName,
          type: order.courierOperation === 'Exchange' ? '2' : '1',
          stop_desk: order.shippingType === 'Desk' ? '1' : '0',
          fragile: order.isFragile ? '1' : undefined,
          gps_link: order.gpsLink ?? undefined
        }
      })
    }

    for (let i = 0; i < ready.length; i += 100) {
      const chunk = ready.slice(i, i + 100)
      let byReference: Record<string, { tracking?: string; errors?: string[] }>
      try {
        byReference = (await this.dhd.createOrders(baseUrl, apiToken, chunk.map((c) => c.payload))).byReference
      } catch (error) {
        for (const c of chunk) failed.push({ orderId: c.order.id, reason: (error as Error).message })
        continue
      }
      for (const { order } of chunk) {
        const outcome = byReference[order.id]
        if (!outcome?.tracking) {
          failed.push({ orderId: order.id, reason: outcome?.errors?.join(' ') || 'The courier did not return a result for this order.' })
          continue
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.shipment.create({ data: { orderId: order.id, courierId: courier.id, trackingReference: outcome.tracking!, courierStatus: 'created' } })
          await tx.order.update({ where: { id: order.id }, data: { state: 'HandedToCourier' } })
        })
        dispatched.push({ orderId: order.id, trackingReference: outcome.tracking, confirmed: false })
      }
    }

    // Confirm ("Expedier") each created parcel; a failure leaves it created but
    // unconfirmed (visible in the UI, one click to retry).
    if (confirm) {
      for (const d of dispatched) {
        try {
          await this.confirmAtCourier(d.orderId, d.trackingReference, shippingCompanyId, opts.askCollection ?? true, actor)
          d.confirmed = true
        } catch (error) {
          this.logger.warn(`Order ${d.orderId}: created but confirming failed: ${(error as Error).message}`)
        }
      }
    }

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: 'bulk',
      metadata: { dhdAction: 'bulk-create', dispatchedCount: dispatched.length, failedCount: failed.length, confirm }
    })
    for (const d of dispatched) this.syncShippingInfoToSheets(d.orderId)

    return { dispatched, failed, skipped }
  }

  // "Valider la réception des retours" — confirms physical receipt of
  // returned parcels back at the shop, by order id (resolved to each
  // order's shipment tracking reference). Only orders assigned to the same
  // shipping company as each other in one call are supported — same
  // reasoning as bulkDispatch. Advances state to ReturnedToOrigin where
  // that's a legal transition from the order's current state; otherwise the
  // DHD-side confirmation still happens but the order's state is left
  // alone rather than forcing an illegal jump.
  async validateReturns(orderIds: string[], actor: AuditActor) {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { shipment: true }
    })
    const withTracking = orders.filter((o) => o.shipment?.trackingReference && o.shippingCompanyId)
    if (withTracking.length === 0) return { validated: [], skipped: orderIds }

    const shippingCompanyId = withTracking[0]!.shippingCompanyId!
    const sameCompany = withTracking.filter((o) => o.shippingCompanyId === shippingCompanyId)
    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(shippingCompanyId)
    const trackings = sameCompany.map((o) => o.shipment!.trackingReference!)
    await this.dhd.validateReturns(baseUrl, apiToken, trackings)

    const validated: { orderId: string; advancedTo: string | null }[] = []
    for (const order of sameCompany) {
      const canAdvance = isValidTransition(order.state as never, 'ReturnedToOrigin' as never)
      if (canAdvance) {
        await this.prisma.order.update({ where: { id: order.id }, data: { state: 'ReturnedToOrigin' } })
      }
      validated.push({ orderId: order.id, advancedTo: canAdvance ? 'ReturnedToOrigin' : null })
    }

    const validatedIds = new Set(sameCompany.map((o) => o.id))
    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: 'bulk',
      metadata: { dhdAction: 'validate-returns', orderIds: [...validatedIds] }
    })

    return { validated, skipped: orders.filter((o) => !validatedIds.has(o.id)).map((o) => o.id) }
  }

  // ---- Courier status sync, tracking details, notes ------------------------

  // Statuses a courier may move through on its own, in the order a parcel
  // travels. Used to walk an order through any intermediate steps when the
  // courier jumps ahead (e.g. straight from "en préparation" to "livré").
  private static readonly SHIPPING_PATH_STATES: OrderState[] = ['HandedToCourier', 'OutForDelivery', 'DeliveryFailed', 'Delivered', 'ReturnedToOrigin']
  private static readonly SYNC_ACTIVE_STATES: OrderState[] = ['Packed', 'HandedToCourier', 'OutForDelivery', 'DeliveryFailed', 'Delivered', 'ReturnedToOrigin', 'CashCollected']

  // Shortest legal route from `from` to `to`, passing only through shipping
  // stages (never through our own finance steps like Reconciled). null = the
  // courier's status would move the order backwards or sideways: ignored.
  private pathTo(from: OrderState, to: OrderState): OrderState[] | null {
    if (from === to) return []
    if (VALID_TRANSITIONS[from]?.includes(to)) return [to]
    const queue: OrderState[][] = [[from]]
    const seen = new Set<OrderState>([from])
    while (queue.length) {
      const path = queue.shift()!
      const last = path[path.length - 1]!
      for (const next of VALID_TRANSITIONS[last] ?? []) {
        if (seen.has(next)) continue
        if (next === to) return [...path.slice(1), next]
        if (!FulfillmentService.SHIPPING_PATH_STATES.includes(next)) continue
        seen.add(next)
        queue.push([...path, next])
      }
    }
    return null
  }

  // The courier reports local (Algiers, UTC+1) wall-clock times without a zone.
  private parseCourierDate(date?: string | null, time?: string | null): Date {
    if (!date) return new Date()
    const iso = date.includes(' ') || date.includes('T') ? date.replace(' ', 'T') : `${date}T${time ?? '00:00:00'}`
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}+01:00`)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }

  // Appends to the permanent courier-side history (see ShipmentEvent). Safe to
  // call repeatedly with the same entries: dedupKey makes it idempotent.
  private async recordCourierEvents(shipment: { id: string; orderId: string }, events: { source: string; kind: 'status' | 'activity' | 'remark'; code?: string | null; title: string; details?: string | null; station?: string | null; driver?: string | null; occurredAt: Date; dedupKey: string; raw?: unknown }[]) {
    if (!events.length) return
    await this.prisma.shipmentEvent.createMany({
      data: events.map((e) => ({
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        source: e.source,
        kind: e.kind,
        code: e.code ?? null,
        title: e.title,
        details: e.details ?? null,
        station: e.station ?? null,
        driver: e.driver ?? null,
        occurredAt: e.occurredAt,
        dedupKey: e.dedupKey,
        raw: (e.raw ?? undefined) as object | undefined
      })),
      skipDuplicates: true
    })
  }

  // Applies a courier status string (the codes used by get/orders and tracking
  // info) to a shipment and its order, through the same state machine as admin
  // actions and webhooks. Idempotent; unknown or backwards statuses are only
  // recorded on the shipment.
  async applyRawStatus(shipmentId: string, rawStatus: string, source: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, include: { order: true } })
    if (!shipment) return { applied: false, reason: 'unknown shipment' }
    const mapped = courierStatusToOrderState(rawStatus)

    if (shipment.courierStatus !== rawStatus) {
      await this.recordCourierEvents(shipment, [
        { source, kind: 'status', code: rawStatus, title: `Courier status: ${courierStatusLabel(rawStatus)}`, occurredAt: new Date(), dedupKey: `status:${rawStatus}:${Date.now()}` }
      ])
    }

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        courierStatus: rawStatus,
        // Any status past "ready to ship" means the courier has taken the parcel.
        // (also for codes we don't know yet: only "ready to ship" means still unconfirmed)
        ...(!['prete_a_expedier', 'pret_a_expedier'].includes(normalizeCourierStatus(rawStatus)) && !shipment.carrierConfirmedAt && { carrierConfirmedAt: new Date() })
      }
    })
    if (mapped === undefined) {
      this.logger.warn(`Unknown courier status "${rawStatus}" for order ${shipment.orderId} — recorded, not applied`)
      return { applied: false, reason: `unknown status ${rawStatus}` }
    }
    if (mapped === null) return { applied: false, reason: 'status does not advance the order' }

    const from = shipment.order.state
    const path = this.pathTo(from, mapped as OrderState)
    if (!path || path.length === 0) return { applied: false, reason: path ? `order already ${from}` : `no legal path ${from} → ${mapped}` }

    await this.prisma.$transaction(async (tx) => {
      for (const step of path) await tx.order.update({ where: { id: shipment.orderId }, data: { state: step } })
    })
    if (path.includes('CancelledShipping' as OrderState)) await this.stock.releaseForOrder(shipment.orderId)
    let prev: OrderState = from
    for (const step of path) {
      await this.audit.log({
        action: 'StateTransition',
        entity: 'Order',
        entityId: shipment.orderId,
        metadata: { from: prev, to: step, source, courierStatus: rawStatus, trackingReference: shipment.trackingReference }
      })
      this.googleSheets.updateOrderStatus(shipment.orderId, prev, step).catch((error: Error) => {
        this.logger.warn(`Google Sheets status update failed for order ${shipment.orderId}: ${error.message}`)
      })
      prev = step
    }
    return { applied: true, from, to: path[path.length - 1]! }
  }

  private toActivityViews(activity: DhdTrackingInfo['activity']): CourierActivityView[] {
    return activity.map((a) => ({
      reason: a.reason ?? a.activity ?? null,
      details: a.details || null,
      station: a.station || null,
      driver: a.driver || null,
      at: a.date ? `${a.date}${a.time ? `T${a.time}` : ''}` : null,
      postponedTo: a.postponed_to || null
    }))
  }

  // Stores what a courier's tracking info says about a parcel (driver, desk,
  // last delivery-attempt reason, postponement) and applies its status.
  private async applyTrackingInfo(shipmentId: string, info: DhdTrackingInfo, source: string) {
    const activity = this.toActivityViews(info.activity)
    const lastReason = [...activity].reverse().find((a) => a.reason)?.reason ?? null
    const lastPostponed = [...activity].reverse().find((a) => a.postponedTo)?.postponedTo ?? null
    const hasDesk = info.desk_phone || info.desk_commune || info.desk_address || info.desk_map_link
    const owner = await this.prisma.shipment.findUnique({ where: { id: shipmentId }, select: { id: true, orderId: true } })
    if (owner) {
      await this.recordCourierEvents(owner, info.activity.map((a) => {
        const title = a.reason ?? a.activity ?? 'Update'
        const parts = [a.details, a.postponed_to ? `Postponed to ${a.postponed_to}` : null].filter(Boolean)
        return {
          source,
          kind: 'activity' as const,
          code: a.activity ?? null,
          title,
          details: parts.length ? parts.join(' — ') : null,
          station: a.station || null,
          driver: a.driver || null,
          occurredAt: this.parseCourierDate(a.date, a.time),
          dedupKey: `act:${a.date ?? ''}|${a.time ?? ''}|${title}|${a.details ?? ''}|${a.driver ?? ''}`,
          raw: a
        }
      }))
    }
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        activity: activity as unknown as object,
        lastFailureReason: lastReason,
        postponedTo: lastPostponed ? new Date(lastPostponed) : null,
        lastSyncedAt: new Date(),
        ...(info.driver_name && { driverName: info.driver_name }),
        ...(info.driver_phone && { driverPhone: info.driver_phone }),
        ...(hasDesk && { deskInfo: { phone: info.desk_phone, commune: info.desk_commune, address: info.desk_address, mapLink: info.desk_map_link } })
      }
    })
    if (info.status) return this.applyRawStatus(shipmentId, info.status, source)
    return { applied: false, reason: 'no status' }
  }

  private toCents(value: string | null): number | null {
    if (value == null) return null
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }

  private trackingView(shipment: { trackingReference: string | null; courierStatus: string | null; carrierConfirmedAt: Date | null; driverName: string | null; driverPhone: string | null; lastFailureReason: string | null; postponedTo: Date | null; deskInfo: unknown; carrierFeeCents: number | null; returnFeeCents: number | null; lastSyncedAt: Date | null; activity: unknown }, updates: DhdParcelUpdate[] = []): ShipmentTrackingView {
    const desk = shipment.deskInfo as { phone: string | null; commune: string | null; address: string | null; mapLink: string | null } | null
    return {
      trackingReference: shipment.trackingReference,
      courierStatus: shipment.courierStatus,
      confirmed: !!shipment.carrierConfirmedAt,
      driverName: shipment.driverName,
      driverPhone: shipment.driverPhone,
      lastFailureReason: shipment.lastFailureReason,
      postponedTo: shipment.postponedTo?.toISOString() ?? null,
      desk: desk ?? null,
      carrierFeeCents: shipment.carrierFeeCents,
      returnFeeCents: shipment.returnFeeCents,
      lastSyncedAt: shipment.lastSyncedAt?.toISOString() ?? null,
      activity: Array.isArray(shipment.activity) ? (shipment.activity as CourierActivityView[]) : [],
      updates: updates.map((u): CourierUpdateView => ({ remark: u.remarque, station: u.station || null, driver: u.livreur || null, at: u.created_at || null }))
    }
  }

  // The courier's view of an order's parcel. With refresh=true it is fetched
  // live first (tracking info, parcel updates, fees) and stored; otherwise the
  // last stored snapshot is returned.
  async getShipmentTracking(orderId: string, refresh: boolean): Promise<ShipmentTrackingView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment) throw new BadRequestException('Order has no shipment yet.')
    let updates: DhdParcelUpdate[] = []

    if (refresh && order.shipment.trackingReference && order.shippingCompanyId && order.fulfillmentMethod === 'ShippingCompany') {
      const tracking = order.shipment.trackingReference
      const { baseUrl, apiToken } = await this.dhdCompanyForOrder(order.shippingCompanyId)
      const infos = await this.dhd.getTrackingsInfo(baseUrl, apiToken, [tracking])
      const info = infos[tracking]
      if (info) await this.applyTrackingInfo(order.shipment.id, info, 'courier-refresh')
      updates = await this.dhd.getUpdates(baseUrl, apiToken, tracking)
      await this.recordCourierEvents(order.shipment, updates.map((u) => ({
        source: 'courier-refresh',
        kind: 'remark' as const,
        title: 'Remark',
        details: u.remarque,
        station: u.station || null,
        driver: u.livreur || null,
        occurredAt: this.parseCourierDate(u.created_at),
        dedupKey: `maj:${u.created_at}|${u.remarque}`,
        raw: u
      })))
      const page = await this.dhd.getOrders(baseUrl, apiToken, { tracking })
      const listed = page.data.find((o) => o.tracking === tracking)
      if (listed) {
        await this.prisma.shipment.update({
          where: { id: order.shipment.id },
          data: { carrierFeeCents: this.toCents(listed.tarif_prestation), returnFeeCents: this.toCents(listed.tarif_retour) }
        })
        if (!info && listed.status) await this.applyRawStatus(order.shipment.id, listed.status, 'courier-refresh')
      }
    }
    // Stamp the attempt itself: when the courier has no entry for this parcel nothing
    // else would update it, and "stale" would stay true forever.
    if (refresh) await this.prisma.shipment.update({ where: { id: order.shipment.id }, data: { lastSyncedAt: new Date() } })
    const fresh = await this.prisma.shipment.findUniqueOrThrow({ where: { id: order.shipment.id } })
    return this.trackingView(fresh, updates)
  }

  // One pass for a company: refresh every active parcel's status/details from
  // the courier (the webhook is not reliable on its own), then fill in the
  // courier's fees for parcels that don't have them yet.
  async syncCompany(company: { id: string; baseUrl: string; apiToken: string | null }) {
    const result = { checked: 0, applied: 0, feesFilled: 0 }
    if (!company.apiToken) return result
    const shipments = await this.prisma.shipment.findMany({
      where: {
        trackingReference: { not: null },
        order: { shippingCompanyId: company.id, fulfillmentMethod: 'ShippingCompany', state: { in: FulfillmentService.SYNC_ACTIVE_STATES } }
      },
      select: { id: true, trackingReference: true, carrierFeeCents: true }
    })
    if (!shipments.length) return result

    const infos = await this.dhd.getTrackingsInfo(company.baseUrl, company.apiToken, shipments.map((s) => s.trackingReference!))
    for (const shipment of shipments) {
      const info = infos[shipment.trackingReference!]
      result.checked++
      if (!info) continue
      const outcome = await this.applyTrackingInfo(shipment.id, info, 'courier-sync')
      if (outcome.applied) result.applied++
    }

    const missing = new Map(shipments.filter((s) => s.carrierFeeCents == null).map((s) => [s.trackingReference!, s.id]))
    for (let page = 1; missing.size > 0 && page <= 15; page++) {
      const res = await this.dhd.getOrders(company.baseUrl, company.apiToken, { page })
      for (const listed of res.data) {
        const id = missing.get(listed.tracking)
        if (!id) continue
        await this.prisma.shipment.update({ where: { id }, data: { carrierFeeCents: this.toCents(listed.tarif_prestation), returnFeeCents: this.toCents(listed.tarif_retour) } })
        missing.delete(listed.tracking)
        result.feesFilled++
      }
      if (page >= res.lastPage) break
    }
    return result
  }

  async syncAllCompanies() {
    const companies = await this.prisma.shippingCompany.findMany({ where: { isLinked: true, apiToken: { not: null } } })
    const summary: { company: string; checked: number; applied: number; feesFilled: number; error?: string }[] = []
    for (const company of companies) {
      try {
        summary.push({ company: company.name, ...(await this.syncCompany(company)) })
      } catch (error) {
        this.logger.warn(`Courier sync failed for ${company.name}: ${(error as Error).message}`)
        summary.push({ company: company.name, checked: 0, applied: 0, feesFilled: 0, error: (error as Error).message })
      }
    }
    return summary
  }

  // Remark / instructions / fragile / GPS / operation type — what the courier
  // gets besides the address. Editable until the courier has the parcel; if a
  // parcel was already created there but not yet confirmed, the change is
  // forwarded to it too.
  async updateDeliveryInfo(orderId: string, input: UpdateDeliveryInfo, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (order.shipment?.carrierConfirmedAt) {
      throw new BadRequestException('The courier already has this parcel: delivery details can no longer be changed. Add a note for the courier instead.')
    }
    const operation = input.courierOperation ?? order.courierOperation
    const exchangeProduct = input.exchangeProduct !== undefined ? input.exchangeProduct : order.exchangeProduct
    if (operation === 'Exchange' && !exchangeProduct) throw new BadRequestException('Exchange orders need the product to collect from the customer.')

    const data = {
      ...(input.deliveryNote !== undefined && { deliveryNote: input.deliveryNote || null }),
      ...(input.isFragile !== undefined && { isFragile: input.isFragile }),
      ...(input.gpsLink !== undefined && { gpsLink: input.gpsLink || null }),
      ...(input.courierOperation !== undefined && { courierOperation: input.courierOperation }),
      ...(input.exchangeProduct !== undefined && { exchangeProduct: input.exchangeProduct || null })
    }
    if (order.shipment?.trackingReference && order.shippingCompanyId && order.fulfillmentMethod === 'ShippingCompany') {
      const { baseUrl, apiToken } = await this.dhdCompanyForOrder(order.shippingCompanyId)
      await this.dhd.updateOrder(baseUrl, apiToken, order.shipment.trackingReference, {
        ...(input.deliveryNote !== undefined && { remarque: input.deliveryNote ?? '' }),
        ...(input.isFragile !== undefined && { fragile: input.isFragile ? '1' : '0' }),
        ...(input.gpsLink !== undefined && { gps_link: input.gpsLink ?? '' }),
        ...(input.courierOperation !== undefined && { type: input.courierOperation === 'Exchange' ? '2' : '1' })
      })
    }
    await this.prisma.order.update({ where: { id: orderId }, data })
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: orderId, metadata: { field: 'deliveryInfo', changes: data } })
    return { orderId, ...data }
  }

  private async confirmedCompanyShipment(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference || !order.shippingCompanyId || order.fulfillmentMethod !== 'ShippingCompany') {
      throw new BadRequestException('This order has no courier shipment with a tracking number.')
    }
    return { order, shipment: order.shipment, trackingReference: order.shipment.trackingReference, shippingCompanyId: order.shippingCompanyId }
  }

  // A remark for the delivery company ("call before 17:00"), visible to the
  // driver — only after the courier has the parcel.
  async addCourierNote(orderId: string, content: string, actor: AuditActor) {
    const { shipment, trackingReference, shippingCompanyId } = await this.confirmedCompanyShipment(orderId)
    if (!shipment.carrierConfirmedAt) throw new BadRequestException('Confirm the shipment with the courier first: notes can only be added after shipping.')
    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(shippingCompanyId)
    await this.dhd.addUpdate(baseUrl, apiToken, trackingReference, content)
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: orderId, metadata: { dhdAction: 'add-maj', trackingReference, content } })
    return { orderId, ok: true }
  }

  // Ask the courier to bring a parcel that is out for delivery back to us. The
  // courier may ignore the request.
  async requestReturn(orderId: string, actor: AuditActor) {
    const { trackingReference, shippingCompanyId } = await this.confirmedCompanyShipment(orderId)
    const { baseUrl, apiToken } = await this.dhdCompanyForOrder(shippingCompanyId)
    await this.dhd.askReturn(baseUrl, apiToken, trackingReference)
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: orderId, metadata: { dhdAction: 'ask-return', trackingReference } })
    return { orderId, ok: true }
  }
}
