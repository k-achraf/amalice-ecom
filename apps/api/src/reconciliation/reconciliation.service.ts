import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  ImportRemittance,
  LedgerEntry,
  LedgerEntryStatus,
  RemittanceBatch,
  RemittanceBatchStatus
} from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// FIN-02/03/04 — the ledger work. This is where a bug costs real money: every
// path here is deliberate, idempotent, and audit-logged. Batches are immutable
// once committed (corrections are new entries); auto-matching is deterministic
// (exact amount + courier ref); discrepancies are never silently accepted.
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // FIN-02 — import a courier remittance batch. Validates each row's shape
  // (already done by the Zod DTO), then commits the whole batch atomically.
  // No partial import: if any row fails the DB constraint, the transaction
  // rolls back and the caller gets a clear error.
  async importBatch(input: ImportRemittance, actor: AuditActor): Promise<RemittanceBatch> {
    if (new Date(input.periodStart) > new Date(input.periodEnd)) {
      throw new BadRequestException('periodStart must be on or before periodEnd')
    }

    const totalCents = input.rows.reduce((sum, r) => sum + r.collectedCents, 0)

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.remittanceBatch.create({
        data: {
          courierId: input.courierId,
          reference: input.reference,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          totalCents,
          status: 'Imported'
        }
      })

      await tx.ledgerEntry.createMany({
        data: input.rows.map((r) => ({
          batchId: batch.id,
          courierRef: r.courierRef,
          collectedCents: r.collectedCents,
          status: 'Unmatched' as LedgerEntryStatus
        }))
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'Create',
          entity: 'RemittanceBatch',
          entityId: batch.id,
          metadata: { reference: batch.reference, rowCount: input.rows.length, totalCents } satisfies Prisma.InputJsonValue
        }
      })

      return {
        id: batch.id,
        courierId: batch.courierId,
        reference: batch.reference,
        periodStart: batch.periodStart.toISOString(),
        periodEnd: batch.periodEnd.toISOString(),
        totalCents: batch.totalCents,
        status: batch.status,
        createdAt: batch.createdAt.toISOString()
      }
    })
  }

  // FIN-03 — auto-match ledger entries to orders by courier reference (the
  // shipment tracking reference). Exact match (amount + ref both align) →
  // Matched + order moves to CashCollected. Amount mismatch → Mismatch
  // (flagged, never silently accepted). No matching order → Unmatched.
  // Idempotent: re-running only touches entries still in Unmatched/Mismatch.
  async autoMatch(batchId: string, actor: AuditActor): Promise<{ matched: number; mismatched: number; unmatched: number }> {
    const batch = await this.prisma.remittanceBatch.findUnique({ where: { id: batchId } })
    if (!batch) throw new NotFoundException('Batch not found')

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { batchId, status: { in: ['Unmatched', 'Mismatch'] } }
    })

    let matched = 0
    let mismatched = 0
    let unmatched = 0

    for (const entry of entries) {
      // The courier ref is the shipment's tracking reference — the join key.
      const shipment = await this.prisma.shipment.findFirst({
        where: { trackingReference: entry.courierRef },
        include: { order: true }
      })

      if (!shipment) {
        unmatched++
        continue
      }

      const order = shipment.order
      // Only Delivered orders are collectable — you can't reconcile cash for
      // an order that wasn't delivered.
      if (order.state !== 'Delivered' && order.state !== 'CashCollected' && order.state !== 'Reconciled') {
        unmatched++
        continue
      }

      if (order.totalCents === entry.collectedCents) {
        // Exact match — entry becomes Matched, order → CashCollected.
        await this.prisma.$transaction(async (tx) => {
          await tx.ledgerEntry.update({
            where: { id: entry.id },
            data: { orderId: order.id, expectedCents: order.totalCents, status: 'Matched' }
          })
          await tx.order.update({ where: { id: order.id }, data: { state: 'CashCollected' } })
          await tx.cashReconciliation.upsert({
            where: { orderId: order.id },
            update: { collectedCents: entry.collectedCents, matched: true, reconciledAt: new Date() },
            create: {
              orderId: order.id,
              expectedCents: order.totalCents,
              collectedCents: entry.collectedCents,
              matched: true,
              reconciledAt: new Date()
            }
          })
        })
        matched++
      } else {
        // Amount differs — flag, never silently accept.
        await this.prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: { orderId: order.id, expectedCents: order.totalCents, status: 'Mismatch' }
        })
        mismatched++
      }
    }

    // Roll up batch status: Discrepancy if any mismatches remain, else Matched.
    const remainingIssues = await this.prisma.ledgerEntry.count({
      where: { batchId, status: { in: ['Mismatch', 'Unmatched'] } }
    })
    const newStatus: RemittanceBatchStatus = remainingIssues > 0 ? 'Discrepancy' : 'Matched'
    await this.prisma.remittanceBatch.update({ where: { id: batchId }, data: { status: newStatus } })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'RemittanceBatch',
      entityId: batchId,
      metadata: { action: 'autoMatch', matched, mismatched, unmatched, newStatus }
    })

    return { matched, mismatched, unmatched }
  }

  // FIN-04 — discrepancy review. Accept-with-reason marks the entry Resolved
  // (the order does NOT auto-reach Settled on a flagged mismatch — that needs
  // explicit finance action per the state machine). Each resolution is itself
  // audit-logged.
  async resolveDiscrepancy(entryId: string, note: string, actor: AuditActor): Promise<LedgerEntry> {
    const entry = await this.prisma.ledgerEntry.findUnique({ where: { id: entryId } })
    if (!entry) throw new NotFoundException('Ledger entry not found')
    if (entry.status === 'Matched') {
      throw new BadRequestException('Entry is already matched, nothing to resolve')
    }

    const updated = await this.prisma.ledgerEntry.update({
      where: { id: entryId },
      data: { status: 'Resolved', resolutionNote: note }
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'LedgerEntry',
      entityId: entryId,
      metadata: { action: 'resolveDiscrepancy', fromStatus: entry.status, note }
    })

    return {
      id: updated.id,
      batchId: updated.batchId,
      orderId: updated.orderId,
      courierRef: updated.courierRef,
      expectedCents: updated.expectedCents,
      collectedCents: updated.collectedCents,
      status: updated.status,
      resolutionNote: updated.resolutionNote,
      createdAt: updated.createdAt.toISOString()
    }
  }

  async listBatches(args: { page: number; pageSize: number; status?: RemittanceBatchStatus }) {
    const where = { ...(args.status && { status: args.status }) }
    const [items, total] = await Promise.all([
      this.prisma.remittanceBatch.findMany({
        where,
        include: { courier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.remittanceBatch.count({ where })
    ])
    return {
      items: items.map((b) => ({
        id: b.id,
        courierId: b.courierId,
        courierName: b.courier.name,
        reference: b.reference,
        periodStart: b.periodStart.toISOString(),
        periodEnd: b.periodEnd.toISOString(),
        totalCents: b.totalCents,
        status: b.status,
        createdAt: b.createdAt.toISOString()
      })),
      total,
      page: args.page,
      pageSize: args.pageSize
    }
  }

  async batchEntries(batchId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' }
    })
  }

  // FIN-04 — the discrepancy queue, sorted by delta size (biggest problems
  // first, per the acceptance criteria).
  async discrepancyQueue() {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { status: { in: ['Mismatch', 'Unmatched'] } },
      include: { order: { select: { id: true, totalCents: true } } },
      orderBy: { createdAt: 'desc' }
    })
    // Sort by delta (collected - expected) magnitude, descending. Entries
    // with no expected (Unmatched) sort to the top — we don't even know what
    // order they belong to.
    return entries
      .map((e) => ({
        id: e.id,
        batchId: e.batchId,
        courierRef: e.courierRef,
        orderId: e.orderId,
        expectedCents: e.expectedCents,
        collectedCents: e.collectedCents,
        status: e.status,
        deltaCents: e.expectedCents !== null ? e.collectedCents - e.expectedCents : null
      }))
      .sort((a, b) => {
        // null expected (Unmatched) first, then largest |delta|.
        if (a.deltaCents === null) return -1
        if (b.deltaCents === null) return 1
        return Math.abs(b.deltaCents) - Math.abs(a.deltaCents)
      })
  }
}
