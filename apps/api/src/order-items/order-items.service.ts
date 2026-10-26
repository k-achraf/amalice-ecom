import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { stockUnits, type AddOrderItem, type OrderState, type UpdateOrderItem } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../generated/prisma/client'
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: { select: { id: true } } } })
    if (!order) throw new NotFoundException('Order not found')
    if (!canAddOrderItems(order.state) || order.shipment) {
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

    // An abandoned cart holds no stock yet (taken when it is confirmed).
    const takesStock = !order.isAbandoned
    const available = variant?.stockQuantity ?? product.stockQuantity
    if (takesStock && available < input.quantity) {
      throw new ConflictException(`Insufficient stock for "${product.name}"`)
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!takesStock) {
        // nothing to reserve
      } else if (variant) {
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

  // Edit one line of an order that hasn't reached a courier yet: its quantity
  // and/or its total price. Stock follows the quantity (whole pieces) unless
  // the order is an abandoned cart, which holds none; Order.totalCents moves
  // by the same line delta so shipping and any manual discount stay as set.
  async updateItem(orderId: string, itemId: string, input: UpdateOrderItem, actor: AuditActor) {
    const { order, item } = await this.loadEditable(orderId, itemId)
    const quantity = input.quantity ?? item.quantity
    const lineTotalCents =
      input.lineTotalCents ?? (input.quantity !== undefined ? Math.round(item.unitPriceCents * quantity) : item.lineTotalCents)
    const stockDelta = order.isAbandoned ? 0 : stockUnits(quantity) - stockUnits(item.quantity)

    await this.prisma.$transaction(async (tx) => {
      if (stockDelta !== 0) await this.moveStock(tx, item, -stockDelta, `Order ${orderId.slice(0, 8)} item quantity edited`, actor)
      await tx.orderItem.update({ where: { id: itemId }, data: { quantity, lineTotalCents } })
      await tx.order.update({ where: { id: orderId }, data: { totalCents: { increment: lineTotalCents - item.lineTotalCents } } })
    })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { field: 'item', itemId, productId: item.productId, from: { quantity: item.quantity, lineTotalCents: item.lineTotalCents }, to: { quantity, lineTotalCents } }
    })
  }

  async removeItem(orderId: string, itemId: string, actor: AuditActor) {
    const { order, item } = await this.loadEditable(orderId, itemId)
    const count = await this.prisma.orderItem.count({ where: { orderId } })
    if (count <= 1) throw new BadRequestException('An order needs at least one item - cancel the order instead.')
    await this.prisma.$transaction(async (tx) => {
      if (!order.isAbandoned) await this.moveStock(tx, item, stockUnits(item.quantity), `Order ${orderId.slice(0, 8)} item removed`, actor)
      await tx.orderItem.delete({ where: { id: itemId } })
      await tx.order.update({ where: { id: orderId }, data: { totalCents: { decrement: item.lineTotalCents } } })
    })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { field: 'item', removedItem: { itemId, productId: item.productId, quantity: item.quantity, lineTotalCents: item.lineTotalCents } }
    })
  }

  private async loadEditable(orderId: string, itemId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipment: { select: { id: true } } } })
    if (!order) throw new NotFoundException('Order not found')
    if (!canAddOrderItems(order.state) || order.shipment) {
      throw new BadRequestException(`Can't edit items of an order in state ${order.state} - it's already with the courier.`)
    }
    const item = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId } })
    if (!item) throw new NotFoundException('Order item not found')
    return { order, item }
  }

  // delta > 0 puts units back on the shelf, < 0 takes them.
  private async moveStock(
    tx: Prisma.TransactionClient,
    item: { productId: string; variantId: string | null },
    delta: number,
    note: string,
    actor: AuditActor
  ) {
    if (delta < 0) {
      const need = -delta
      const result = item.variantId
        ? await tx.productVariant.updateMany({ where: { id: item.variantId, stockQuantity: { gte: need } }, data: { stockQuantity: { decrement: need } } })
        : await tx.product.updateMany({ where: { id: item.productId, stockQuantity: { gte: need } }, data: { stockQuantity: { decrement: need } } })
      if (result.count === 0) throw new ConflictException('Insufficient stock for this quantity')
    } else {
      if (item.variantId) await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stockQuantity: { increment: delta } } })
      else await tx.product.updateMany({ where: { id: item.productId }, data: { stockQuantity: { increment: delta } } })
    }
    await tx.stockAdjustment.create({
      data: { productId: item.productId, variantId: item.variantId, delta, reason: 'Correction', note, actorId: actor?.id ?? null }
    })
  }
}
