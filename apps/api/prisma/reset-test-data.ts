import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// One-off CLI for wiping test data before real launch — deletes every Order
// (abandoned carts included: OrdersService.createAbandonedOrder writes them
// as ordinary Order rows with isAbandoned=true, there's no separate table),
// Customer, and Product row, plus everything that exists only to reference
// them (order items, shipments, per-order cash reconciliation, product
// images/variants/offers/upsells, reviews). Deliberately leaves untouched:
// admin users, shipping companies, categories, wilayas/communes, store
// settings, remittance batches (ledger entries just get their orderId
// cleared, per FIN-01's "nobody hard-deletes from the ledger chain" rule),
// and the audit log (never deleted anywhere in this codebase — orphaned
// entity/entityId rows referencing wiped orders/products are expected and
// harmless, same as any other historical audit entry).
//
// Usage: pnpm --filter api reset-test-data -- --confirm
// Runs as a dry run (counts only, no deletes) unless --confirm is passed.

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--')
  const confirm = args.includes('--confirm')

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  try {
    const [orders, customers, products] = await Promise.all([
      prisma.order.count(),
      prisma.customer.count(),
      prisma.product.count()
    ])
    console.log(`Found ${orders} orders, ${customers} customers, ${products} products.`)

    if (!confirm) {
      console.log('\nDry run only — nothing deleted. Re-run with --confirm to actually delete.')
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { orderId: { not: null } } })
      await tx.ledgerEntry.updateMany({ where: { orderId: { not: null } }, data: { orderId: null } })
      await tx.cashReconciliation.deleteMany({})
      await tx.shipment.deleteMany({})
      await tx.orderItem.deleteMany({})
      await tx.review.deleteMany({})
      await tx.order.deleteMany({})
      await tx.address.deleteMany({})
      await tx.customer.deleteMany({})
      await tx.product.deleteMany({})
    })

    console.log(`✓ Deleted ${orders} orders, ${customers} customers, ${products} products (and their dependent rows).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
