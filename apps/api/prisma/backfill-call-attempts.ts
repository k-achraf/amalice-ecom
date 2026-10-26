import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { STATE_TO_CALL_OUTCOME, type OrderState } from '@amalice/shared'

// One-off: before this fix, a status change made from the order page / lists /
// abandoned-carts page (AdminOrdersService.transition) wrote an audit row but
// no CallAttempt, so those confirmations (and no-answer / wrong number /
// postponed / cancelled changes) were missing from the call-center stats,
// reports, Telegram summary and AI tools. This recreates the missing
// CallAttempt rows from the audit log (same timestamp and agent). Calls logged
// through the call center carry `callOutcome` in their audit row and already
// have an attempt, so they are skipped; re-running is safe.
//
// Usage: pnpm --filter api exec tsx prisma/backfill-call-attempts.ts [--confirm]
// Dry run (counts only) unless --confirm is passed.

async function main() {
  const confirm = process.argv.slice(2).includes('--confirm')
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const logs = await prisma.auditLog.findMany({
    where: { entity: 'Order', action: 'StateTransition' },
    orderBy: { createdAt: 'asc' }
  })
  let created = 0
  const perOutcome: Record<string, number> = {}
  for (const log of logs) {
    const meta = (log.metadata ?? {}) as { from?: OrderState; to?: OrderState; callOutcome?: string; postponedUntil?: string }
    if (meta.callOutcome || !meta.to || !meta.from) continue
    const outcome = STATE_TO_CALL_OUTCOME[meta.to]
    if (!outcome) continue
    const order = await prisma.order.findUnique({ where: { id: log.entityId }, select: { id: true } })
    if (!order) continue
    const exists = await prisma.callAttempt.findFirst({ where: { orderId: order.id, createdAt: log.createdAt }, select: { id: true } })
    if (exists) continue
    perOutcome[outcome] = (perOutcome[outcome] ?? 0) + 1
    created++
    if (!confirm) continue
    await prisma.callAttempt.create({
      data: {
        orderId: order.id,
        agentId: log.actorId,
        agentEmail: log.actorEmail,
        outcome,
        fromState: meta.from,
        toState: meta.to,
        note: 'Status changed from the order page (backfilled)',
        postponedUntil: meta.to === 'Postponed' && meta.postponedUntil ? new Date(meta.postponedUntil) : null,
        createdAt: log.createdAt
      }
    })
  }
  console.log(`${confirm ? 'Created' : 'Would create'} ${created} call attempt(s):`, perOutcome)
  if (!confirm) console.log('Dry run. Re-run with --confirm to write them.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
