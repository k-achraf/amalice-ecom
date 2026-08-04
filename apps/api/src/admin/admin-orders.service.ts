import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { isValidTransition, type OrderState } from '@amalice/shared'
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
  product: { select: { id: true, name: true, slug: true, imageUrl: true } },
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
    product: item.product,
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
