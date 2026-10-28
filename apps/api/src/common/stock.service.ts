import { Injectable } from '@nestjs/common'
import { stockUnits } from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// Order-driven stock movements. An order takes its units out of stock when it is CONFIRMED
// (reserveForOrder), never when it is created: an order that is not confirmed (unreachable,
// wrong number, postponed, abandoned, cancelled by the customer...) never touches the stock.
// The units go back when a confirmed order dies before reaching the customer (releaseForOrder)
// or when a returned parcel is confirmed back on the shelf (restockForOrder).
// Order.stockReservedAt is the single source of truth for "this order currently holds stock":
// each movement flips it atomically, so a repeated call (double click, webhook + admin) is a no-op.
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private async lines(tx: Prisma.TransactionClient, orderId: string) {
    return tx.orderItem.findMany({ where: { orderId }, select: { productId: true, variantId: true, quantity: true } })
  }

  private async move(
    t: Prisma.TransactionClient,
    orderId: string,
    sign: 1 | -1,
    reason: 'Sale' | 'Release' | 'Return',
    note: string,
    actorId?: string | null
  ): Promise<boolean> {
    const lines = await this.lines(t, orderId)
    for (const l of lines) {
      const delta = sign * stockUnits(l.quantity)
      if (l.variantId) await t.productVariant.updateMany({ where: { id: l.variantId }, data: { stockQuantity: { increment: delta } } })
      else await t.product.updateMany({ where: { id: l.productId }, data: { stockQuantity: { increment: delta } } })
      await t.stockAdjustment.create({ data: { productId: l.productId, variantId: l.variantId, orderId, delta, reason, note, actorId: actorId ?? null } })
    }
    return lines.length > 0
  }

  // The order is confirmed: take its units out of stock (once).
  async reserveForOrder(orderId: string, actorId?: string | null, tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (t: Prisma.TransactionClient) => {
      // Abandoned carts are not real orders yet and never hold stock.
      const claimed = await t.order.updateMany({ where: { id: orderId, isAbandoned: false, stockReservedAt: null }, data: { stockReservedAt: new Date() } })
      if (claimed.count === 0) return false
      return this.move(t, orderId, -1, 'Sale', 'Order confirmed', actorId)
    }
    return tx ? run(tx) : this.prisma.$transaction(run)
  }

  // A confirmed order died before shipping (cancelled, courier cancelled it): give the units back.
  // An order that never took stock (never confirmed) gives nothing back.
  async releaseForOrder(orderId: string, actorId?: string | null, tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (t: Prisma.TransactionClient) => {
      const claimed = await t.order.updateMany({ where: { id: orderId, stockReservedAt: { not: null } }, data: { stockReservedAt: null } })
      if (claimed.count === 0) return false
      return this.move(t, orderId, 1, 'Release', 'Order cancelled', actorId)
    }
    return tx ? run(tx) : this.prisma.$transaction(run)
  }

  // A returned parcel confirmed back on the shelf ("Confirm return received" -> Restocked):
  // its units go back into stock (once, and only if the order had taken them).
  async restockForOrder(orderId: string, actorId?: string | null, tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (t: Prisma.TransactionClient) => {
      const claimed = await t.order.updateMany({ where: { id: orderId, stockReservedAt: { not: null } }, data: { stockReservedAt: null } })
      if (claimed.count === 0) return false
      return this.move(t, orderId, 1, 'Return', 'Returned parcel restocked', actorId)
    }
    return tx ? run(tx) : this.prisma.$transaction(run)
  }
}
