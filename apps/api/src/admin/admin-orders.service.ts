import { StockService } from '../common/stock.service'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ADDRESS_EDITABLE_STATES, CALL_CENTER_WORK_STATES, STATES_REQUIRING_SHIPMENT, deriveCallCenterState, deriveShippingState, isValidTransition, normalizeAlgerianPhone, PRICE_EDITABLE_STATES, type OrderState, type RiskLevel, type UpdateOrderCustomerInfo, type UpdateOrderPrice } from '@amalice/shared'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GoogleSheetsService } from '../apps/google-sheets.service'

// Shared item include for both list() and findOne() — variant (with its
// normalized options, the source of truth for display — see
// ProductVariant's Prisma comment) and offer are both joined so every order
// view can show what was actually bought (variant/offer/upsell provenance),
// not just the base product.
const itemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      // Full gallery, not just the denormalized hero — Call Center/Orders/
      // Shipping queues show every shot of the product inline (see
      // AdminOrderLineItem.product's comment in packages/shared).
      images: { orderBy: { sortOrder: 'asc' }, select: { url: true } }
    }
  },
  variant: { include: { options: { include: { option: true } } } },
  offer: true
} satisfies Prisma.OrderItemInclude

type ItemWithRelations = Prisma.OrderItemGetPayload<{ include: typeof itemInclude }>

// Builds the human-readable "Red / Large" variant label from the normalized
// VariantOption relation (falling back to the legacy `attributes` JSON map
// for older variants that predate it — see ProductVariant's Prisma comment).
function variantLabel(item: ItemWithRelations): string | null {
  if (!item.variant) return null
  if (item.variant.options.length) {
    return item.variant.options.map((vo) => vo.option.displayValue ?? vo.option.value).join(' / ')
  }
  const attrs = item.variant.attributes as Record<string, string> | null
  return attrs && Object.keys(attrs).length ? Object.values(attrs).join(' / ') : null
}

// Adds the two derived call-center/shipping fields (see order.ts's
// deriveCallCenterState/deriveShippingState) onto every order shape this
// service returns — every list()/dropQueue()/findOne() caller needs them,
// so it's centralized here rather than repeated at each call site.
function withDerivedStates<T extends { state: OrderState }>(order: T): T & { callCenterState: ReturnType<typeof deriveCallCenterState>; shippingState: ReturnType<typeof deriveShippingState> } {
  return { ...order, callCenterState: deriveCallCenterState(order.state), shippingState: deriveShippingState(order.state) }
}

function toLineItem(item: ItemWithRelations) {
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    offerId: item.offerId,
    isUpsell: item.isUpsell,
    product: { ...item.product, images: item.product.images.map((img) => img.url) },
    variantId: item.variantId,
    variantLabel: variantLabel(item)
  }
}

// ADM-04/ADM-05 — the admin-side order read/transition API. Distinct from
// the public OrdersService (which owns checkout/confirm/track): this is the
// ops-staff surface for the order queue and manual state transitions. Both
// consult the same VALID_TRANSITIONS map so admin and webhook-driven changes
// can't diverge (COU-04).
@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly googleSheets: GoogleSheetsService,
    private readonly stock: StockService
  ) {}

  async list(args: {
    state?: OrderState
    // Restricts to any of these states (used to confine a CallCenterAgent to
    // the call-center queues); combined with `state` as an intersection.
    states?: readonly OrderState[]
    // 'oldest' = longest-waiting first (call-center queues); 'followup' =
    // earliest promised callback first (Postponed queue).
    sort?: 'oldest' | 'followup'
    search?: string
    courierId?: string
    // Only the orders placed on this funnel.
    funnelId?: string
    riskLevel?: RiskLevel
    from?: Date
    to?: Date
    page: number
    pageSize: number
    // Every existing caller (Orders/Call Center/Fulfillment/Shipping pages)
    // omits this, which excludes abandoned-cart orders (see
    // Order.isAbandoned's Prisma comment) so they don't pollute the real
    // queue — only the dedicated Abandoned Carts page passes 'only'.
    abandoned?: 'only' | 'exclude'
    // Same pattern as `abandoned` above: every existing caller omits this,
    // which excludes archived orders (see Order.archived's Prisma comment)
    // from every order-listing page by default — pass 'only' to browse
    // archived orders instead (there is no "all regardless of archived
    // status" mode, matching `abandoned`'s own binary).
    archived?: 'only' | 'exclude'
  }) {
    const where: Prisma.OrderWhereInput = {
      isAbandoned: args.abandoned === 'only',
      archived: args.archived === 'only',
      ...(args.state && !args.states && { state: args.state }),
      ...(args.states && { state: { in: args.state ? args.states.filter((x) => x === args.state) : [...args.states] } }),
      ...(args.courierId && { shipment: { courierId: args.courierId } }),
      ...(args.funnelId && { funnelId: args.funnelId }),
      ...(args.riskLevel && { riskLevel: args.riskLevel }),
      ...((args.from || args.to) && {
        createdAt: { ...(args.from && { gte: args.from }), ...(args.to && { lte: args.to }) }
      }),
      ...(args.search && {
        OR: [
          { id: { equals: args.search, mode: 'insensitive' } },
          { customer: { phone: { contains: args.search, mode: 'insensitive' } } },
          { customer: { name: { contains: args.search, mode: 'insensitive' } } },
          { shipment: { trackingReference: { contains: args.search, mode: 'insensitive' } } }
        ]
      })
    }
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          address: { select: { line1: true, line2: true, city: true, region: true, postalCode: true, country: true } },
          items: { include: itemInclude },
          shipment: { include: { courier: { select: { name: true } } } },
          shippingCompany: { select: { name: true } },
          attribution: { select: { platform: true, utmCampaign: true, campaignName: true } }
        },
        orderBy: args.sort === 'followup' ? [{ postponedUntil: 'asc' }, { createdAt: 'asc' }] : { createdAt: args.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.order.count({ where })
    ])
    const items = rows.map((order) =>
      withDerivedStates({
        ...order,
        items: order.items.map(toLineItem),
        shippingCompanyName: order.shippingCompany?.name ?? null,
        attribution: order.attribution && { platform: order.attribution.platform, campaign: order.attribution.campaignName ?? order.attribution.utmCampaign }
      })
    )
    return { items, total, page: args.page, pageSize: args.pageSize }
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        address: true,
        items: { include: itemInclude },
        shipment: { include: { courier: true } },
        shippingCompany: { select: { name: true } },
        cashReconciliation: true,
        attribution: true,
        notifications: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    })
    if (!order) throw new NotFoundException('Order not found')
    return withDerivedStates({ ...order, items: order.items.map(toLineItem), shippingCompanyName: order.shippingCompany?.name ?? null })
  }

  // Soft-hide an order out of every default order-listing view (Orders,
  // Call Center, Fulfillment, Shipping, Drop Queue — see Order.archived's
  // Prisma comment and list()/dropQueue()'s own where clauses). Never a
  // hard delete: reconciliation/audit history must not dangle, and this
  // stays fully reversible via unarchive() below. Does not touch `state` —
  // archiving is orthogonal to the order's actual fulfillment status
  // (a Cancelled, Delivered, or still-Pending order can equally be
  // archived, e.g. to clear old test/junk orders out of daily view).
  async archiveOrder(id: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    await this.prisma.order.update({ where: { id }, data: { archived: true, archivedAt: new Date(), assignedToId: null, assignedToEmail: null, lockedUntil: null } })
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: id, metadata: { archived: true } })
    return { id, archived: true }
  }

  async unarchiveOrder(id: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    await this.prisma.order.update({ where: { id }, data: { archived: false, archivedAt: null } })
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: id, metadata: { archived: false } })
    return { id, archived: false }
  }

  // ADM-05 — manual state transition. Re-validates against the state machine
  // server-side (client-side gating is UX only). Every transition is
  // audit-logged with from/to (SEC-03). Rejecting illegal transitions here
  // means the UI can't bypass the machine even if it tried.
  async transition(id: string, to: OrderState, actor: AuditActor, postponedUntil?: string, role?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    const from = order.state
    // A CallCenterAgent only works the call-center queues: they may not touch
    // an order that already left them, nor push one into fulfillment/shipping/
    // finance states (Packed, Delivered, CashCollected...).
    if (role === 'CallCenterAgent') {
      const allowedTargets: OrderState[] = [...CALL_CENTER_WORK_STATES, 'Confirmed', 'Cancelled']
      if (!CALL_CENTER_WORK_STATES.includes(from) || !allowedTargets.includes(to)) {
        throw new ForbiddenException('Call-center agents can only move orders between the call-center states')
      }
    }
    if (from === to) throw new BadRequestException(`Order is already ${to}`)
    // Never "in transit" without a courier shipment: it must be created via
    // Dispatch to courier, or recorded with Mark as sent (manual).
    if (STATES_REQUIRING_SHIPMENT.includes(to)) {
      const shipment = await this.prisma.shipment.findUnique({ where: { orderId: id }, select: { id: true } })
      if (!shipment) {
        throw new BadRequestException('Create the shipment first: use "Dispatch to courier", or "Mark as sent" if it was created manually at the courier.')
      }
    }
    if (!isValidTransition(from, to)) {
      throw new BadRequestException(`Illegal transition: ${from} → ${to}`)
    }
    // TransitionOrderSchema already requires postponedUntil in the request
    // body when to === 'Postponed' — this is the server-side backstop for
    // the same rule (never trust client-side validation alone).
    if (to === 'Postponed' && !postponedUntil) {
      throw new BadRequestException('postponedUntil is required when postponing an order')
    }

    // Confirming an abandoned-cart order (see Order.isAbandoned's Prisma
    // comment) is the admin-side equivalent of createLeadOrder's own
    // convertsAbandonedOrderId conversion — the agent has now made real
    // contact, so it stops being a "did the customer even finish?" row and
    // becomes a normal order the rest of the pipeline (fulfillment/shipping,
    // the main Orders list, drop-queue's own next fetch) can see. Every
    // other query in this service filters on isAbandoned, so leaving it
    // true here would silently strand a confirmed order forever.
    const clearsAbandoned = order.isAbandoned && to === 'Confirmed'
    await this.prisma.order.update({
      where: { id },
      data: {
        state: to,
        // postponedUntil is scoped to CURRENT Postponed status — cleared on
        // every other transition so a stale date never lingers on an order
        // that has since moved on (e.g. confirmed after a later, different
        // call), which would otherwise misreport if it's ever postponed again.
        postponedUntil: to === 'Postponed' ? new Date(postponedUntil!) : null,
        // Any state change ends the current claim on the order.
        assignedToId: null,
        assignedToEmail: null,
        lockedUntil: null,
        ...(clearsAbandoned && { isAbandoned: false })
      }
    })
    if (clearsAbandoned) await this.stock.reserveForOrder(id, actor.id)
    if (to === 'Cancelled' || to === 'CancelledShipping') await this.stock.releaseForOrder(id, actor.id)
    if (to === 'Restocked') await this.stock.restockForOrder(id, actor.id)
    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: id,
      metadata: { from, to, ...(clearsAbandoned && { convertedFromAbandoned: true }), ...(to === 'Postponed' && { postponedUntil }) }
    })

    // Fire-and-forget, same rule as OrdersService's pixel/Sheets calls at
    // order-creation time — a Sheets outage or misconfiguration must never
    // block a status change. GoogleSheetsService itself already no-ops
    // cheaply when the feature is disabled/unconfigured or this order was
    // never pushed to any sheet.
    this.googleSheets.updateOrderStatus(id, from, to).catch((error: Error) => {
      this.logger.warn(`Google Sheets status update failed for order ${id}: ${error.message}`)
    })

    return this.findOne(id)
  }

  // Confirms returned parcels are physically back: each order still in
  // ReturnedToOrigin moves to Restocked, which puts its units back in stock
  // (see transition). Anything else is skipped with the reason, not forced.
  async bulkRestock(orderIds: string[], actor: AuditActor) {
    const restocked: string[] = []
    const skipped: { id: string; reason: string }[] = []
    for (const id of orderIds) {
      const order = await this.prisma.order.findUnique({ where: { id }, select: { state: true } })
      if (!order) { skipped.push({ id, reason: 'not found' }); continue }
      if (order.state !== 'ReturnedToOrigin') { skipped.push({ id, reason: `state is ${order.state}` }); continue }
      await this.transition(id, 'Restocked', actor)
      restocked.push(id)
    }
    return { restocked, skipped }
  }

  // Call-center price override (ADM-12) — lets an agent adjust the shipping
  // fee and/or the overall total while negotiating on the confirmation
  // call. Only legal while the order is still in one of the 4 call-center
  // states (see PRICE_EDITABLE_STATES's comment for why it's locked once
  // Confirmed) — re-checked here server-side regardless of what the admin
  // UI already gates, same rule as transition()'s own state-machine check.
  async updatePrice(id: string, input: UpdateOrderPrice, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    if (!PRICE_EDITABLE_STATES.includes(order.state)) {
      throw new BadRequestException(`Can't edit price for an order in state ${order.state} — it's already past the call-center confirmation step.`)
    }

    let shippingPriceCents = order.shippingPriceCents
    let totalCents = order.totalCents

    // A shipping change alone shifts the total by the same delta (the items
    // portion is untouched); an explicit totalCents in the same request is
    // an absolute override that wins over that computed shift — lets an
    // agent apply a shipping fix and a separate discount in one call.
    if (input.shippingPriceCents !== undefined) {
      totalCents += input.shippingPriceCents - shippingPriceCents
      shippingPriceCents = input.shippingPriceCents
    }
    if (input.totalCents !== undefined) {
      totalCents = input.totalCents
    }
    if (totalCents < 0) throw new BadRequestException('Total cannot be negative')

    await this.prisma.order.update({ where: { id }, data: { shippingPriceCents, totalCents } })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: id,
      metadata: {
        field: 'price',
        from: { shippingPriceCents: order.shippingPriceCents, totalCents: order.totalCents },
        to: { shippingPriceCents, totalCents }
      }
    })

    return this.findOne(id)
  }

  // Call-center notes — free text, not part of the state machine (no
  // transition, no isValidTransition check). Mirrored into the Google
  // Sheets Notes column the same way a state change mirrors into the status
  // columns.
  async updateNotes(id: string, notes: string | null, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')

    await this.prisma.order.update({ where: { id }, data: { notes } })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: id,
      metadata: { field: 'notes', from: order.notes, to: notes }
    })

    this.googleSheets.updateNotes(id, notes).catch((error: Error) => {
      this.logger.warn(`Google Sheets notes update failed for order ${id}: ${error.message}`)
    })

    return this.findOne(id)
  }

  // Customer/address/shipping-method correction (ADM-14) — a call-center
  // agent catching a typo'd name, wrong commune, or the wrong home/desk pick
  // mid-call. Same pre-confirmation window as updatePrice (see
  // PRICE_EDITABLE_STATES) — editing the delivery address or shipping
  // method after Confirmed would desync what fulfillment has already
  // picked/dispatched against.
  //
  // customerPhone is the one genuinely risky field: Customer.phone is
  // globally unique (checkout/lead-form upsert-by-phone, abandoned-cart
  // matching) — silently overwriting it could merge this order's contact
  // details onto a DIFFERENT real customer's history if the new number
  // already belongs to someone else. Rejected with a clear conflict instead
  // of ever letting that happen quietly.
  async updateCustomerInfo(id: string, input: UpdateOrderCustomerInfo, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { customer: true, address: true, shipment: { select: { id: true } } } })
    if (!order) throw new NotFoundException('Order not found')
    if (!ADDRESS_EDITABLE_STATES.includes(order.state) || order.shipment) {
      throw new BadRequestException(`Can't edit customer info for an order in state ${order.state}${order.shipment ? ' with a shipment' : ''} — it's already with the courier or past packing.`)
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {}

    if (input.customerPhone !== undefined) {
      const normalized = normalizeAlgerianPhone(input.customerPhone)
      if (normalized !== order.customer.phone) {
        const existing = await this.prisma.customer.findUnique({ where: { phone: normalized } })
        if (existing && existing.id !== order.customerId) {
          throw new ConflictException('That phone number already belongs to a different customer — merging customer records is not supported here.')
        }
        changes.customerPhone = { from: order.customer.phone, to: normalized }
      }
    }
    if (input.customerName !== undefined && input.customerName !== order.customer.name) {
      changes.customerName = { from: order.customer.name, to: input.customerName }
    }
    if (input.wilaya !== undefined && input.wilaya !== order.address.region) {
      changes.wilaya = { from: order.address.region, to: input.wilaya }
    }
    if (input.commune !== undefined && input.commune !== order.address.city) {
      changes.commune = { from: order.address.city, to: input.commune }
    }
    if (input.addressLine1 !== undefined && input.addressLine1 !== order.address.line1) {
      changes.addressLine1 = { from: order.address.line1, to: input.addressLine1 }
    }
    if (input.shippingType !== undefined && input.shippingType !== order.shippingType) {
      changes.shippingType = { from: order.shippingType, to: input.shippingType }
    }

    if (Object.keys(changes).length === 0) return this.findOne(id)

    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (changes.customerName || changes.customerPhone) {
      ops.push(
        this.prisma.customer.update({
          where: { id: order.customerId },
          data: {
            ...(changes.customerName && { name: input.customerName }),
            ...(changes.customerPhone && { phone: normalizeAlgerianPhone(input.customerPhone!) })
          }
        })
      )
    }
    if (changes.wilaya || changes.commune || changes.addressLine1) {
      ops.push(
        this.prisma.address.update({
          where: { id: order.addressId },
          data: {
            ...(changes.wilaya && { region: input.wilaya }),
            ...(changes.commune && { city: input.commune }),
            ...(changes.addressLine1 && { line1: input.addressLine1 })
          }
        })
      )
    }
    if (changes.shippingType) {
      ops.push(this.prisma.order.update({ where: { id }, data: { shippingType: input.shippingType } }))
    }
    await this.prisma.$transaction(ops)

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: id,
      metadata: { field: 'customerInfo', changes }
    })

    return this.findOne(id)
  }
}
