import { Injectable } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// Order-driven stock movements. Stock is taken when an order is created
// (OrdersService.decrementStock) — that is the reservation. This gives it back
// when an order dies before shipping, and takes it when an abandoned-cart
// order is confirmed (abandoned carts never decrement). Both write a
// StockAdjustment row keyed by orderId so a repeat call is a no-op.
@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private async lines(tx: Prisma.TransactionClient, orderId: string) {
    return tx.orderItem.findMany({ where: { orderId }, select: { productId: true, variantId: true, quantity: true } })
  }

  async releaseForOrder(orderId: string, actorId?: string | null, tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (t: Prisma.TransactionClient) => {
      const order = await t.order.findUnique({ where: { id: orderId }, select: { isAbandoned: true } })
      // Abandoned rows never took stock.
      if (!order || order.isAbandoned) return false
      if (await t.stockAdjustment.findFirst({ where: { orderId, reason: 'Release' }, select: { id: true } })) return false
      const lines = await this.lines(t, orderId)
      for (const l of lines) {
        if (l.variantId) await t.productVariant.updateMany({ where: { id: l.variantId }, data: { stockQuantity: { increment: l.quantity } } })
        else await t.product.updateMany({ where: { id: l.productId }, data: { stockQuantity: { increment: l.quantity } } })
        await t.stockAdjustment.create({
          data: { productId: l.productId, variantId: l.variantId, orderId, delta: l.quantity, reason: 'Release', note: 'Order cancelled', actorId: actorId ?? null }
        })
      }
      return lines.length > 0
    }
    return tx ? run(tx) : this.prisma.$transaction(run)
  }

  // A returned parcel confirmed back on the shelf: units go back into stock.
  // Idempotent per order (one Return row set). Called when an order reaches
  // Restocked — the explicit "received and counted" step after ReturnedToOrigin.
  async restockForOrder(orderId: string, actorId?: string | null): Promise<boolean> {
    return this.prisma.$transaction(async (t) => {
      if (await t.stockAdjustment.findFirst({ where: { orderId, reason: 'Return' }, select: { id: true } })) return false
      // A cancelled-before-ship order was already released; never give it back twice.
      if (await t.stockAdjustment.findFirst({ where: { orderId, reason: 'Release' }, select: { id: true } })) return false
      const lines = await this.lines(t, orderId)
      for (const l of lines) {
        if (l.variantId) await t.productVariant.updateMany({ where: { id: l.variantId }, data: { stockQuantity: { increment: l.quantity } } })
        else await t.product.updateMany({ where: { id: l.productId }, data: { stockQuantity: { increment: l.quantity } } })
        await t.stockAdjustment.create({
          data: { productId: l.productId, variantId: l.variantId, orderId, delta: l.quantity, reason: 'Return', note: 'Returned parcel restocked', actorId: actorId ?? null }
        })
      }
      return lines.length > 0
    })
  }

  // Called when an abandoned-cart order becomes a real (confirmed) one.
  async reserveForOrder(orderId: string, actorId?: string | null): Promise<boolean> {
    return this.prisma.$transaction(async (t) => {
      if (await t.stockAdjustment.findFirst({ where: { orderId, reason: 'Sale' }, select: { id: true } })) return false
      const lines = await this.lines(t, orderId)
      for (const l of lines) {
        if (l.variantId) await t.productVariant.updateMany({ where: { id: l.variantId }, data: { stockQuantity: { decrement: l.quantity } } })
        else await t.product.updateMany({ where: { id: l.productId }, data: { stockQuantity: { decrement: l.quantity } } })
        await t.stockAdjustment.create({
          data: { productId: l.productId, variantId: l.variantId, orderId, delta: -l.quantity, reason: 'Sale', note: 'Abandoned cart confirmed', actorId: actorId ?? null }
        })
      }
      return lines.length > 0
    })
  }
}
