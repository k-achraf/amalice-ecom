import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// One-time cleanup after the policy change "stock is taken when an order is CONFIRMED, not when it
// is created". Orders created before the change that are still unconfirmed (new / no answer / wrong
// number / postponed) took their units at creation; this gives those units back and marks the orders
// as holding none, so they take stock again only if they get confirmed.
//
//   pnpm rebalance-unconfirmed-stock            -> dry run: prints what would move
//   pnpm rebalance-unconfirmed-stock --apply    -> does it (each order in its own transaction, safe to re-run)
const UNCONFIRMED = ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed'] as const

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const apply = process.argv.includes('--apply')
const units = (q: number) => Math.ceil(q)

async function main() {
  const orders = await prisma.order.findMany({
    where: { archived: false, isAbandoned: false, stockReservedAt: { not: null }, state: { in: [...UNCONFIRMED] } },
    select: { id: true, state: true, items: { select: { productId: true, variantId: true, quantity: true } } }
  })
  const perProduct = new Map<string, number>()
  for (const o of orders) for (const i of o.items) perProduct.set(i.variantId ?? i.productId, (perProduct.get(i.variantId ?? i.productId) ?? 0) + units(i.quantity))
  console.log(`${orders.length} unconfirmed order(s) still hold stock, ${[...perProduct.values()].reduce((a, b) => a + b, 0)} unit(s) over ${perProduct.size} product/variant(s).`)
  if (!apply) {
    console.log('Dry run: nothing changed. Re-run with --apply to give these units back.')
    return
  }
  let done = 0
  for (const o of orders) {
    await prisma.$transaction(async (t) => {
      const claimed = await t.order.updateMany({ where: { id: o.id, stockReservedAt: { not: null }, state: { in: [...UNCONFIRMED] } }, data: { stockReservedAt: null } })
      if (claimed.count === 0) return
      for (const i of o.items) {
        const delta = units(i.quantity)
        if (i.variantId) await t.productVariant.updateMany({ where: { id: i.variantId }, data: { stockQuantity: { increment: delta } } })
        else await t.product.updateMany({ where: { id: i.productId }, data: { stockQuantity: { increment: delta } } })
        await t.stockAdjustment.create({
          data: { productId: i.productId, variantId: i.variantId, orderId: o.id, delta, reason: 'Release', note: 'Unconfirmed order: stock is now taken only when the order is confirmed' }
        })
      }
      done++
    })
  }
  console.log(`Gave back the stock of ${done} order(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
