import { Injectable, Logger } from '@nestjs/common'
import { CALL_CENTER_MAX_ATTEMPTS } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../common/audit.service'

// "No answer" orders never leave the call center on their own, so they would pile up
// forever. Once an order has been called CALL_CENTER_MAX_ATTEMPTS times, or is older
// than this many days, it is archived (soft-hidden, state untouched; Orders → Archived
// brings it back and "unarchive" restores it).
export const NO_ANSWER_ARCHIVE_DAYS = 3
const DAY = 24 * 60 * 60 * 1000

@Injectable()
export class CallCenterSweepService {
  private readonly logger = new Logger(CallCenterSweepService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async archiveStaleNoAnswer(): Promise<number> {
    const now = new Date()
    const tooOld = new Date(now.getTime() - NO_ANSWER_ARCHIVE_DAYS * DAY)
    const rows = await this.prisma.order.findMany({
      where: {
        archived: false,
        state: 'CallCenterNoAnswer',
        OR: [{ callAttemptsCount: { gte: CALL_CENTER_MAX_ATTEMPTS } }, { createdAt: { lte: tooOld } }]
      },
      select: { id: true, callAttemptsCount: true },
      take: 500
    })
    for (const row of rows) {
      // Re-check the state in the write itself: an agent may have just reached the customer.
      const done = await this.prisma.order.updateMany({
        where: { id: row.id, archived: false, state: 'CallCenterNoAnswer' },
        data: { archived: true, archivedAt: now, assignedToId: null, assignedToEmail: null, lockedUntil: null }
      })
      if (done.count === 1) {
        await this.audit.log({
          actor: null,
          action: 'Update',
          entity: 'Order',
          entityId: row.id,
          metadata: { archived: true, auto: true, reason: row.callAttemptsCount >= CALL_CENTER_MAX_ATTEMPTS ? 'max-call-attempts' : `no-answer-older-than-${NO_ANSWER_ARCHIVE_DAYS}-days` }
        })
      }
    }
    if (rows.length) this.logger.log(`Auto-archived ${rows.length} unanswered order(s)`)
    return rows.length
  }
}
