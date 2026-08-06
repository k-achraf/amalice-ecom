import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { isValidTransition, PRICE_EDITABLE_STATES, type OrderState, type UpdateOrderPrice } from '@amalice/shared'
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
    private readonly googleSheets: GoogleSheetsService
  ) {}

  async list(args: {
    state?: OrderState
    search?: string
    courierId?: string
    from?: Date
    to?: Date
    page: number
    pageSize: number
    // Every existing caller (Orders/Call Center/Fulfillment/Shipping pages)
    // omits this, which excludes abandoned-cart orders (see
    // Order.isAbandoned's Prisma comment) so they don't pollute the real
    // queue — only the dedicated Abandoned Carts page passes 'only'.
    abandoned?: 'only' | 'exclude'
  }) {
    const where: Prisma.OrderWhereInput = {
      isAbandoned: args.abandoned === 'only',
      ...(args.state && { state: args.state }),
      ...(args.courierId && { shipment: { courierId: args.courierId } }),
      ...((args.from || args.to) && {
        createdAt: { ...(args.from && { gte: args.from }), ...(args.to && { lte: args.to }) }
      }),
      ...(args.search && {
        OR: [
          { id: { equals: args.search, mode: 'insensitive' } },
          { customer: { phone: { contains: args.search, mode: 'insensitive' } } },
          { customer: { name: { contains: args.search, mode: 'insensitive' } } }
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
          shippingCompany: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.order.count({ where })
    ])
    const items = rows.map((order) => ({
      ...order,
      items: order.items.map(toLineItem),
      shippingCompanyName: order.shippingCompany?.name ?? null
    }))
    return { items, total, page: args.page, pageSize: args.pageSize }
  }

  // Call Center's "Drop Queue" (ADM-11) — a single-order-at-a-time power-
  // dialer view. Combines all 4 call-center states into one priority-ranked
  // list so an agent never has to think about which of the 4 index.vue
  // queues to work next; the page just pulls item [0], the agent acts on
  // it, and the next findMany (after the state changes) naturally drops it
  // out of this list and promotes whatever's now first.
  //
  // Priority: brand-new leads first (tier 1) — conversion drops fast with
  // response time, so a lead that's never been called outranks a retry.
  // No-answer retries (tier 2) and postponed follow-ups (tier 3) come next.
  // Wrong-number (tier 4) sinks to the bottom — these usually need the
  // customer's number corrected via another channel (SMS/WhatsApp) before a
  // call is even possible, so surfacing them first would waste dial time.
  // Within a tier: higher COD value first (bigger RTO loss if never
  // confirmed), then oldest-first as the final tiebreak so nothing starves.
  //
  // Capped at 500 rows before sorting rather than loading the entire
  // backlog — call-center backlogs are bounded in practice (an unconfirmed
  // queue that size is its own emergency); revisit if that stops holding.
  private static readonly DROP_QUEUE_STATES: OrderState[] = ['PendingCallCenter', 'CallCenterNoAnswer', 'Postponed', 'WrongNumber']
  private static readonly DROP_QUEUE_TIER: Record<string, number> = {
    PendingCallCenter: 1,
    CallCenterNoAnswer: 2,
    Postponed: 3,
    WrongNumber: 4
  }

  async dropQueue(pageSize: number) {
    const rows = await this.prisma.order.findMany({
      where: { isAbandoned: false, state: { in: AdminOrdersService.DROP_QUEUE_STATES } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        address: { select: { line1: true, line2: true, city: true, region: true, postalCode: true, country: true } },
        items: { include: itemInclude },
        shipment: { include: { courier: { select: { name: true } } } },
        shippingCompany: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 500
    })
    const items = rows
      .map((order) => ({
        ...order,
        items: order.items.map(toLineItem),
        shippingCompanyName: order.shippingCompany?.name ?? null
      }))
      .sort((a, b) => {
        const tierDiff = AdminOrdersService.DROP_QUEUE_TIER[a.state] - AdminOrdersService.DROP_QUEUE_TIER[b.state]
        if (tierDiff !== 0) return tierDiff
        if (a.totalCents !== b.totalCents) return b.totalCents - a.totalCents
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
    return { items: items.slice(0, pageSize), total: items.length }
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
        notifications: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    })
    if (!order) throw new NotFoundException('Order not found')
    return { ...order, items: order.items.map(toLineItem), shippingCompanyName: order.shippingCompany?.name ?? null }
  }

  // ADM-05 — manual state transition. Re-validates against the state machine
  // server-side (client-side gating is UX only). Every transition is
  // audit-logged with from/to (SEC-03). Rejecting illegal transitions here
  // means the UI can't bypass the machine even if it tried.
  async transition(id: string, to: OrderState, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    const from = order.state
    if (from === to) throw new BadRequestException(`Order is already ${to}`)
    if (!isValidTransition(from, to)) {
      throw new BadRequestException(`Illegal transition: ${from} → ${to}`)
    }

    await this.prisma.order.update({ where: { id }, data: { state: to } })
    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: id,
      metadata: { from, to }
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
}
