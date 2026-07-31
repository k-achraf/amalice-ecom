import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AddOrderItem, OrderState } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Upsells system's shared mutation core — used by BOTH the admin/call-center
// "add item to order" endpoint (AdminOrdersController) and the public
// storefront post-checkout upsell accept endpoint (OrdersController), so
// price resolution, stock decrement, and Order.totalCents bookkeeping can't
// drift between the two entry points. Actor is null for the public path
// (the customer accepted it themselves, not an admin acting on their
// behalf) — AuditService already treats a null actor as a system event.
const EDITABLE_STATES: readonly OrderState[] = [
  'PendingCallCenter',
  'CallCenterNoAnswer',
  'WrongNumber',
  'Postponed',
  'Confirmed',
  'OnHold',
  'Packed'
]

// Adding items after this point (courier already has a fixed COD amount to
// collect) would desync what's actually collectible from what the order
// says is owed — so once shipped, an order's item list is frozen.
export function canAddOrderItems(state: OrderState): boolean {
  return EDITABLE_STATES.includes(state)
}

@Injectable()
export class OrderItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async addItem(orderId: string, input: AddOrderItem, actor: AuditActor | null) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundException('Order not found')
    if (!canAddOrderItems(order.state)) {
      throw new BadRequestException(`Can't add items to an order in state ${order.state} — it's already past fulfillment.`)
    }

    const product = await this.prisma.product.findUnique({ where: { id: input.productId } })
    if (!product) throw new NotFoundException('Product not found')

    const variant = input.variantId ? await this.prisma.productVariant.findUnique({ where: { id: input.variantId } }) : null
    if (input.variantId && (!variant || variant.productId !== input.productId)) {
      throw new BadRequestException('Selected variant not found for this product')
    }

    // priceCentsOverride is write-only from the caller's side (never derived
    // from anything the client already trusts) — it's how a call-center
    // agent pitches an upsell at a special price, or how a configured
    // ProductUpsell.priceCentsOverride flows through from the storefront's
    // accept endpoint.
    const unitPriceCents = input.priceCentsOverride ?? variant?.priceCents ?? product.priceCents
    const lineTotalCents = unitPriceCents * input.quantity

    const available = variant?.stockQuantity ?? product.stockQuantity
    if (available < input.quantity) {
      throw new ConflictException(`Insufficient stock for "${product.name}"`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (variant) {
        const result = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQuantity: { gte: input.quantity } },
          data: { stockQuantity: { decrement: input.quantity } }
        })
        if (result.count === 0) throw new ConflictException(`Insufficient stock for "${product.name}"`)
      } else {
        const result = await tx.product.updateMany({
          where: { id: product.id, stockQuantity: { gte: input.quantity } },
          data: { stockQuantity: { decrement: input.quantity } }
        })
        if (result.count === 0) throw new ConflictException(`Insufficient stock for "${product.name}"`)
      }

      await tx.orderItem.create({
        data: {
          orderId,
          productId: input.productId,
          variantId: variant?.id ?? null,
          quantity: input.quantity,
          unitPriceCents,
          lineTotalCents,
          isUpsell: input.isUpsell ?? false
        }
      })

      return tx.order.update({
        where: { id: orderId },
        data: { totalCents: { increment: lineTotalCents } },
        include: {
          items: { include: { product: { select: { id: true, name: true, slug: true, imageUrl: true } }, variant: { include: { options: true } }, offer: true } }
        }
      })
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: {
        addedItem: { productId: input.productId, variantId: variant?.id ?? null, quantity: input.quantity, unitPriceCents, isUpsell: input.isUpsell ?? false }
      }
    })

    return updated
  }
}
