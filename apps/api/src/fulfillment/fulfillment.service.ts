import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { NormalizedCourierStatus } from './courier-provider.interface'
import { CourierProvider, COURIER_PROVIDER } from './courier-provider.interface'
import { isValidTransition } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { DhdApiService, type DhdOrderPayload } from '../shipping-companies/dhd-api.service'

// Maps the courier's normalized status onto the order lifecycle (plan §7).
// This is the single place that translation happens — COU-04's "one code path
// for admin-changed and courier-told" rule. Both the webhook handler and the
// admin manual-transition path funnel through here for status writes.
const STATUS_TO_ORDER_STATE: Record<NormalizedCourierStatus, string | null> = {
  created: null, // shipment created, but order stays HandedToCourier (set on createShipment)
  picked_up: 'HandedToCourier',
  in_transit: 'HandedToCourier',
  out_for_delivery: 'OutForDelivery',
  delivered: 'Delivered',
  delivery_failed: 'DeliveryFailed',
  returned: 'ReturnedToOrigin',
  cancelled: 'Cancelled'
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
    private readonly dhd: DhdApiService
  ) {}

  private async dhdCompany() {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider: 'Dhd' } })
    if (!company?.isLinked || !company.apiToken) {
      throw new BadRequestException('DHD is not linked — link it under Settings → Shipping Companies first.')
    }
    return { baseUrl: company.baseUrl, apiToken: company.apiToken }
  }

  // COU-03 — create the shipment when an order is dispatched. Looks up the
  // default courier (the first one; multi-courier assignment is ADM-13). On
  // success, order → HandedToCourier + the tracking reference is stored.
  async createShipmentForOrder(orderId: string, actor: AuditActor) {
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

    // The first courier is the default in v1 — real multi-courier assignment
    // is ADM-13's job. If no couriers exist, the seed (which creates
    // FastShip) must be run.
    const courier = await this.prisma.courier.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!courier) throw new BadRequestException('No courier configured')

    const result = await this.courier.createShipment({
      orderId: order.id,
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
      items: order.items.map((item) => ({ name: item.product.name, quantity: item.quantity }))
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
      metadata: { from: 'Packed', to: 'HandedToCourier', trackingReference: result.trackingReference, courier: courier.name }
    })

    return { orderId, trackingReference: result.trackingReference, courierStatus: result.courierStatus }
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
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no DHD shipment yet — dispatch it first.')

    const { baseUrl, apiToken } = await this.dhdCompany()
    await this.dhd.shipOrder(baseUrl, apiToken, order.shipment.trackingReference, askCollection)

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { dhdAction: 'expedier', trackingReference: order.shipment.trackingReference, askCollection }
    })

    return { orderId, trackingReference: order.shipment.trackingReference }
  }

  // "Supprimer une commande" — cancels the shipment with DHD (goes through
  // the CourierProvider interface, same as createShipment, so it works
  // regardless of which provider is bound). The order itself is reverted to
  // Packed so staff can fix whatever needed changing and re-dispatch, rather
  // than getting stuck in HandedToCourier with a dead shipment reference.
  async cancelShipmentForOrder(orderId: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no shipment to cancel.')

    await this.courier.cancelShipment(order.shipment.trackingReference)

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

    return { orderId, cancelled: true, revertedToPacked: canRevert }
  }

  // "Modifier une commande" — edit address/contact/remark fields on a DHD
  // order that hasn't been picked up yet. Only forwards the subset of
  // fields the caller actually provided; DHD leaves anything omitted
  // unchanged.
  async updateShipmentForOrder(orderId: string, fields: Partial<Pick<DhdOrderPayload, 'nom_client' | 'telephone' | 'telephone_2' | 'adresse' | 'commune' | 'montant' | 'remarque' | 'stop_desk' | 'fragile'>>, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true } })
    if (!order) throw new NotFoundException('Order not found')
    if (!order.shipment?.trackingReference) throw new BadRequestException('Order has no DHD shipment to update.')

    const { baseUrl, apiToken } = await this.dhdCompany()
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

    const { baseUrl, apiToken } = await this.dhdCompany()
    return this.dhd.getLabel(baseUrl, apiToken, order.shipment.trackingReference)
  }

  // "Ajouter plusieurs commandes" — dispatch several Packed orders to DHD in
  // one request. Per-order results come back independently (DHD partial-
  // success semantics: some orders in the batch can fail while others
  // succeed) — only the orders DHD actually returned a tracking number for
  // get a Shipment row + HandedToCourier transition; the rest are reported
  // back to the caller as failures, order state untouched so they can be
  // fixed and retried individually via createShipmentForOrder.
  async bulkDispatch(orderIds: string[], actor: AuditActor) {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { customer: true, address: true, shipment: true, items: { include: { product: true } } }
    })

    const dispatchable = orders.filter((o) => o.state === 'Packed' && !o.shipment)
    const skipped = orders
      .filter((o) => !(o.state === 'Packed' && !o.shipment))
      .map((o) => ({ orderId: o.id, reason: o.shipment ? 'already has a shipment' : `not Packed (currently ${o.state})` }))
    if (dispatchable.length === 0) return { dispatched: [], failed: [], skipped }

    const { baseUrl, apiToken } = await this.dhdCompany()

    const wilayaNames = [...new Set(dispatchable.map((o) => o.address.region))]
    const wilayas = await this.prisma.wilaya.findMany({ where: { name: { in: wilayaNames } } })
    const wilayaCodeByName = new Map(wilayas.map((w) => [w.name, w.id]))

    const payloads: DhdOrderPayload[] = dispatchable.map((order) => ({
      reference: order.id,
      nom_client: order.customer.name ?? '',
      telephone: order.customer.phone,
      adresse: order.address.line2 ? `${order.address.line1}, ${order.address.line2}` : order.address.line1,
      commune: order.address.city,
      code_wilaya: wilayaCodeByName.get(order.address.region) ?? '',
      montant: String(Math.round(order.totalCents / 100)),
      produit: order.items.map((i) => i.product.name).join(',') || undefined,
      stock: '0',
      quantite: order.items.map((i) => String(i.quantity)).join(',') || undefined,
      type: '1',
      stop_desk: order.shippingType === 'Desk' ? '1' : '0'
    }))

    const result = await this.dhd.createOrders(baseUrl, apiToken, payloads)

    const dispatched: { orderId: string; trackingReference: string }[] = []
    const failed: { orderId: string; reason: string }[] = []

    await this.prisma.$transaction(async (tx) => {
      const courier = await tx.courier.findFirst({ orderBy: { createdAt: 'asc' } })
      for (let i = 0; i < dispatchable.length; i++) {
        const order = dispatchable[i]!
        const outcome = result.results[String(i)]
        if (typeof outcome !== 'string') {
          failed.push({ orderId: order.id, reason: outcome ? Object.values(outcome).flat().join(' ') : 'unknown error' })
          continue
        }
        if (!courier) {
          failed.push({ orderId: order.id, reason: 'No courier configured' })
          continue
        }
        await tx.shipment.create({
          data: { orderId: order.id, courierId: courier.id, trackingReference: outcome, courierStatus: 'created' }
        })
        await tx.order.update({ where: { id: order.id }, data: { state: 'HandedToCourier' } })
        dispatched.push({ orderId: order.id, trackingReference: outcome })
      }
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: 'bulk',
      metadata: { dhdAction: 'bulk-create', dispatchedCount: dispatched.length, failedCount: failed.length }
    })

    return { dispatched, failed, skipped }
  }

  // "Valider la réception des retours" — confirms physical receipt of
  // returned parcels back at the shop, by order id (resolved to each
  // order's shipment tracking reference). Advances state to
  // ReturnedToOrigin where that's a legal transition from the order's
  // current state; otherwise the DHD-side confirmation still happens but
  // the order's state is left alone rather than forcing an illegal jump.
  async validateReturns(orderIds: string[], actor: AuditActor) {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { shipment: true }
    })
    const withTracking = orders.filter((o) => o.shipment?.trackingReference)
    if (withTracking.length === 0) return { validated: [], skipped: orderIds }

    const { baseUrl, apiToken } = await this.dhdCompany()
    const trackings = withTracking.map((o) => o.shipment!.trackingReference!)
    await this.dhd.validateReturns(baseUrl, apiToken, trackings)

    const validated: { orderId: string; advancedTo: string | null }[] = []
    for (const order of withTracking) {
      const canAdvance = isValidTransition(order.state as never, 'ReturnedToOrigin' as never)
      if (canAdvance) {
        await this.prisma.order.update({ where: { id: order.id }, data: { state: 'ReturnedToOrigin' } })
      }
      validated.push({ orderId: order.id, advancedTo: canAdvance ? 'ReturnedToOrigin' : null })
    }

    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: 'bulk',
      metadata: { dhdAction: 'validate-returns', orderIds: withTracking.map((o) => o.id) }
    })

    return { validated, skipped: orders.filter((o) => !o.shipment?.trackingReference).map((o) => o.id) }
  }
}
