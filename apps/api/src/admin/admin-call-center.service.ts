import { StockService } from '../common/stock.service'
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  CALL_CENTER_MAX_ATTEMPTS,
  CALL_CENTER_WORK_STATES,
  CALL_LOCK_MINUTES,
  CALL_OUTCOME_TO_STATE,
  SKIP_DEFER_MINUTES,
  noAnswerCooldownHours,
  type AgentPerformanceRow,
  type CallAttemptView,
  type CallCenterCounts,
  type CallCenterReport,
  type CallCenterStatsResponse,
  type CallOutcome,
  type CustomerCallHistory,
  type LogCall,
  type OrderState
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GoogleSheetsService } from '../apps/google-sheets.service'
import { AdminOrdersService } from './admin-orders.service'

const WORK_STATES = CALL_CENTER_WORK_STATES as OrderState[]
const HOUR = 3600 * 1000
// Algeria is UTC+1 all year (no DST) — "today" and daily buckets use that day.
const ALGIERS_OFFSET = HOUR
const NOTES_MAX = 2000

function emptyCounts(): CallCenterCounts {
  return { Confirmed: 0, NoAnswer: 0, WrongNumber: 0, Postponed: 0, Cancelled: 0 }
}

function algiersDayStart(now = new Date()): Date {
  const local = now.getTime() + ALGIERS_OFFSET
  return new Date(Math.floor(local / (24 * HOUR)) * 24 * HOUR - ALGIERS_OFFSET)
}

interface Candidate {
  id: string
  state: OrderState
  isAbandoned: boolean
  totalCents: number
  createdAt: Date
  updatedAt: Date
  postponedUntil: Date | null
  callAttemptsCount: number
  lastCalledAt: Date | null
  assignedToId: string | null
  lockedUntil: Date | null
  skippedUntil: Date | null
}

// Tier 0: a postponed follow-up whose time has come — the customer asked for
// this call, so it outranks everything. 1: brand-new leads (conversion drops
// fast with response time). 2: no-answer retries. 3: postponed with no date
// (legacy). 4: abandoned carts (lowest intent). 5: retries that already hit
// the max attempts — still workable, but only when nothing else is waiting.
function tierOf(o: Candidate): number {
  if (o.callAttemptsCount >= CALL_CENTER_MAX_ATTEMPTS) return 5
  if (o.isAbandoned) return 4
  if (o.state === 'Postponed') return o.postponedUntil ? 0 : 3
  if (o.state === 'PendingCallCenter') return 1
  return 2
}

@Injectable()
export class AdminCallCenterService {
  private readonly logger = new Logger(AdminCallCenterService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly googleSheets: GoogleSheetsService,
    private readonly orders: AdminOrdersService,
    private readonly stock: StockService
  ) {}

  // ---- queue ---------------------------------------------------------------

  // Orders that are workable right now: right state, cooldown / follow-up date
  // reached. Lock and skip filtering is separate so the summary can count
  // "waiting" orders without hiding the ones another agent currently holds.
  private async loadWorkable(now: Date): Promise<Candidate[]> {
    const rows = (await this.prisma.order.findMany({
      where: { archived: false, state: { in: WORK_STATES } },
      select: {
        id: true,
        state: true,
        isAbandoned: true,
        totalCents: true,
        createdAt: true,
        updatedAt: true,
        postponedUntil: true,
        callAttemptsCount: true,
        lastCalledAt: true,
        assignedToId: true,
        lockedUntil: true,
        skippedUntil: true
      },
      orderBy: { createdAt: 'asc' },
      take: 1000
    })) as Candidate[]

    return rows.filter((o) => {
      // Wrong numbers need a corrected number first — never auto-dialed.
      if (o.state === 'WrongNumber') return false
      if (o.state === 'CallCenterNoAnswer') {
        const last = (o.lastCalledAt ?? o.updatedAt).getTime()
        return last + noAnswerCooldownHours(o.callAttemptsCount) * HOUR <= now.getTime()
      }
      if (o.state === 'Postponed') return !o.postponedUntil || o.postponedUntil <= now
      return true
    })
  }

  private static rank(list: Candidate[]): Candidate[] {
    return [...list].sort((a, b) => {
      const ta = tierOf(a)
      const tb = tierOf(b)
      if (ta !== tb) return ta - tb
      // Due follow-ups: earliest promised time first. Everything else: oldest
      // first so nothing starves; value only breaks a same-hour tie.
      if (ta === 0) return a.postponedUntil!.getTime() - b.postponedUntil!.getTime()
      const hourA = Math.floor(a.createdAt.getTime() / HOUR)
      const hourB = Math.floor(b.createdAt.getTime() / HOUR)
      if (hourA !== hourB) return hourA - hourB
      return b.totalCents - a.totalCents
    })
  }

  private static heldByOther(o: Candidate, agentId: string, now: Date): boolean {
    return !!o.lockedUntil && o.lockedUntil > now && !!o.assignedToId && o.assignedToId !== agentId
  }

  // Hands the calling agent the next order and locks it to them, atomically —
  // two agents hitting this at once can never receive the same order.
  async claimNext(actor: AuditActor) {
    const now = new Date()
    const lockUntil = new Date(now.getTime() + CALL_LOCK_MINUTES * 60 * 1000)

    // Resume what this agent already holds (page reload / reopened tab).
    const mine = await this.prisma.order.findFirst({
      where: { assignedToId: actor.id, lockedUntil: { gt: now }, state: { in: WORK_STATES }, archived: false },
      select: { id: true }
    })
    if (mine) {
      await this.prisma.order.update({ where: { id: mine.id }, data: { lockedUntil: lockUntil } })
      return { order: await this.orders.findOne(mine.id) }
    }

    const candidates = AdminCallCenterService.rank(
      (await this.loadWorkable(now)).filter((o) => !AdminCallCenterService.heldByOther(o, actor.id, now) && !(o.skippedUntil && o.skippedUntil > now))
    )
    for (const c of candidates.slice(0, 25)) {
      const claimed = await this.prisma.order.updateMany({
        where: {
          id: c.id,
          state: c.state,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }, { assignedToId: actor.id }]
        },
        data: { assignedToId: actor.id, assignedToEmail: actor.email, lockedUntil: lockUntil }
      })
      if (claimed.count === 1) {
        await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: c.id, metadata: { callCenter: 'claimed' } })
        return { order: await this.orders.findOne(c.id) }
      }
    }
    return { order: null }
  }

  // Heartbeat: keeps the lock alive while the agent has the order open.
  async touchLock(id: string, actor: AuditActor) {
    const now = new Date()
    const res = await this.prisma.order.updateMany({
      where: {
        id,
        archived: false,
        state: { in: WORK_STATES },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }, { assignedToId: actor.id }]
      },
      data: { assignedToId: actor.id, assignedToEmail: actor.email, lockedUntil: new Date(now.getTime() + CALL_LOCK_MINUTES * 60 * 1000) }
    })
    if (res.count === 0) throw new ConflictException('This order is being handled by another agent')
    return { ok: true }
  }

  async release(id: string, actor: AuditActor) {
    await this.prisma.order.updateMany({ where: { id, assignedToId: actor.id }, data: { assignedToId: null, assignedToEmail: null, lockedUntil: null } })
    return { ok: true }
  }

  // "Skip for now": released and hidden from the auto-queue for a while, for
  // everyone — not just a local reordering that vanishes on refresh.
  async skip(id: string, actor: AuditActor) {
    const res = await this.prisma.order.updateMany({
      where: { id, archived: false, state: { in: WORK_STATES }, OR: [{ assignedToId: null }, { assignedToId: actor.id }] },
      data: { assignedToId: null, assignedToEmail: null, lockedUntil: null, skippedUntil: new Date(Date.now() + SKIP_DEFER_MINUTES * 60 * 1000) }
    })
    if (res.count === 0) throw new ConflictException('This order is being handled by another agent')
    await this.audit.log({ actor, action: 'Update', entity: 'Order', entityId: id, metadata: { callCenter: 'skipped' } })
    return { ok: true }
  }

  // ---- logging a call -------------------------------------------------------

  private static appendNote(existing: string | null, agentEmail: string, note: string): string {
    const stamp = new Date(Date.now() + ALGIERS_OFFSET).toISOString().slice(5, 16).replace('T', ' ')
    const line = `[${stamp} ${agentEmail.split('@')[0]}] ${note}`
    let next = existing ? `${existing}\n${line}` : line
    // Keep the newest history when the limit is hit, never silently refuse a call log.
    while (next.length > NOTES_MAX && next.includes('\n')) next = next.slice(next.indexOf('\n') + 1)
    return next.slice(-NOTES_MAX)
  }

  async logCall(id: string, input: LogCall, actor: AuditActor, canOverrideLock: boolean) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { address: true, customer: { select: { name: true } }, _count: { select: { items: true } } }
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.archived) throw new BadRequestException('This order is archived.')
    if (!WORK_STATES.includes(order.state)) {
      throw new BadRequestException(`This order is ${order.state} — it's no longer in the call center.`)
    }
    const now = new Date()
    if (!canOverrideLock && order.lockedUntil && order.lockedUntil > now && order.assignedToId && order.assignedToId !== actor.id) {
      throw new ConflictException(`This order is being handled by ${order.assignedToEmail ?? 'another agent'}`)
    }

    const to = CALL_OUTCOME_TO_STATE[input.outcome]
    if (input.outcome === 'Confirmed') {
      if (order._count.items === 0) throw new BadRequestException('The order has no items')
      if (!order.shippingType) throw new BadRequestException('Choose the delivery type (home / stop desk) before confirming')
      if (!order.address.line1.trim() || !order.address.city.trim() || !order.address.region.trim()) {
        throw new BadRequestException('The delivery address is incomplete (wilaya, commune and address are required)')
      }
    }
    if (input.outcome === 'Postponed' && new Date(input.postponedUntil!).getTime() < now.getTime() - 60_000) {
      throw new BadRequestException('The follow-up time must be in the future')
    }

    const note = input.note?.trim() || null
    const clearsAbandoned = order.isAbandoned && input.outcome === 'Confirmed'
    const updated = await this.prisma.order.updateMany({
      // Guarding on the state we read makes two agents racing on one order
      // impossible: the loser matches zero rows instead of overwriting.
      where: { id, state: order.state },
      data: {
        state: to,
        postponedUntil: input.outcome === 'Postponed' ? new Date(input.postponedUntil!) : null,
        callAttemptsCount: { increment: 1 },
        lastCalledAt: now,
        assignedToId: null,
        assignedToEmail: null,
        lockedUntil: null,
        skippedUntil: null,
        ...(note && { notes: AdminCallCenterService.appendNote(order.notes, actor.email, note) }),
        ...(clearsAbandoned && { isAbandoned: false })
      }
    })
    if (updated.count === 0) throw new ConflictException('This order was just updated by someone else — reload it')

    if (clearsAbandoned) await this.stock.reserveForOrder(id, actor.id)
    if (input.outcome === 'Cancelled') await this.stock.releaseForOrder(id, actor.id)

    const attempt = await this.prisma.callAttempt.create({
      data: {
        orderId: id,
        agentId: actor.id,
        agentEmail: actor.email,
        outcome: input.outcome,
        fromState: order.state,
        toState: to,
        note,
        reason: input.outcome === 'Cancelled' ? input.reason : null,
        postponedUntil: input.outcome === 'Postponed' ? new Date(input.postponedUntil!) : null
      }
    })

    if (order.state !== to) {
      await this.audit.log({
        actor,
        action: 'StateTransition',
        entity: 'Order',
        entityId: id,
        metadata: {
          from: order.state,
          to,
          callOutcome: input.outcome,
          ...(clearsAbandoned && { convertedFromAbandoned: true }),
          ...(input.outcome === 'Postponed' && { postponedUntil: input.postponedUntil }),
          ...(input.outcome === 'Cancelled' && { reason: input.reason })
        }
      })
      this.googleSheets.updateOrderStatus(id, order.state, to).catch((error: Error) => {
        this.logger.warn(`Google Sheets status update failed for order ${id}: ${error.message}`)
      })
    }
    if (note) {
      const full = await this.prisma.order.findUnique({ where: { id }, select: { notes: true } })
      this.googleSheets.updateNotes(id, full?.notes ?? null).catch((error: Error) => {
        this.logger.warn(`Google Sheets notes update failed for order ${id}: ${error.message}`)
      })
    }

    const attempts = order.callAttemptsCount + 1
    return {
      order: await this.orders.findOne(id),
      attempt: this.toAttemptView(attempt),
      maxAttemptsReached: input.outcome === 'NoAnswer' && attempts >= CALL_CENTER_MAX_ATTEMPTS
    }
  }

  private toAttemptView(a: { id: string; orderId: string; agentEmail: string | null; outcome: CallOutcome; note: string | null; reason: string | null; postponedUntil: Date | null; createdAt: Date }): CallAttemptView {
    return {
      id: a.id,
      orderId: a.orderId,
      agentEmail: a.agentEmail,
      outcome: a.outcome,
      note: a.note,
      reason: a.reason,
      postponedUntil: a.postponedUntil?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString()
    }
  }

  async calls(orderId: string): Promise<CallAttemptView[]> {
    const rows = await this.prisma.callAttempt.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' }, take: 50 })
    return rows.map((r) => this.toAttemptView(r))
  }

  // Previous orders of the same customer — the first thing an agent wants to
  // know before dialing (a customer with 3 returns is a different call).
  async customerHistory(orderId: string): Promise<CustomerCallHistory> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } })
    if (!order) throw new NotFoundException('Order not found')
    const rows = await this.prisma.order.findMany({
      where: { customerId: order.customerId, id: { not: orderId }, isAbandoned: false, archived: false },
      select: { id: true, state: true, totalCents: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    const delivered: OrderState[] = ['Delivered', 'CashCollected', 'Reconciled', 'Settled']
    const returned: OrderState[] = ['ReturnedToOrigin', 'Restocked', 'DeliveryFailed']
    const cancelled: OrderState[] = ['Cancelled', 'CancelledShipping']
    const count = (set: OrderState[]) => rows.filter((r) => set.includes(r.state)).length
    return {
      totalOrders: rows.length,
      delivered: count(delivered),
      returned: count(returned),
      cancelled: count(cancelled),
      inProgress: rows.length - count(delivered) - count(returned) - count(cancelled),
      previous: rows.slice(0, 8).map((r) => ({ id: r.id, state: r.state, totalCents: r.totalCents, createdAt: r.createdAt.toISOString() }))
    }
  }

  // ---- stats & reports --------------------------------------------------------

  async stats(actor: AuditActor): Promise<CallCenterStatsResponse> {
    const now = new Date()
    const since = algiersDayStart(now)
    const rows = await this.prisma.callAttempt.groupBy({
      by: ['outcome', 'agentId'],
      // Calls on archived orders don't count.
      where: { createdAt: { gte: since }, order: { archived: false } },
      _count: { _all: true }
    })
    const team = emptyCounts()
    const me = emptyCounts()
    for (const r of rows) {
      team[r.outcome] += r._count._all
      if (r.agentId === actor.id) me[r.outcome] += r._count._all
    }

    const workable = await this.loadWorkable(now)
    const available = workable.filter((o) => !AdminCallCenterService.heldByOther(o, actor.id, now))
    const wrongNumber = await this.prisma.order.count({ where: { state: 'WrongNumber', archived: false } })
    return {
      team,
      me,
      queue: {
        new: available.filter((o) => o.state === 'PendingCallCenter' && !o.isAbandoned).length,
        noAnswer: available.filter((o) => o.state === 'CallCenterNoAnswer').length,
        postponed: available.filter((o) => o.state === 'Postponed').length,
        wrongNumber,
        abandoned: available.filter((o) => o.isAbandoned).length,
        dueNow: available.filter((o) => tierOf(o) === 0).length
      }
    }
  }

  async report(from: Date, to: Date): Promise<CallCenterReport> {
    const attempts = await this.prisma.callAttempt.findMany({
      where: { createdAt: { gte: from, lte: to }, order: { archived: false } },
      include: { order: { select: { id: true, totalCents: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50_000
    })

    type Acc = { row: AgentPerformanceRow; orders: Set<string>; confirmedOrders: Set<string> }
    const agents = new Map<string, Acc>()
    const totals = emptyCounts()
    const allOrders = new Set<string>()
    const confirmedOrders = new Map<string, number>()
    const dailyMap = new Map<string, { date: string; calls: number; confirmed: number; cancelled: number }>()
    const reasons = new Map<string, number>()

    for (const a of attempts) {
      totals[a.outcome]++
      allOrders.add(a.orderId)
      const key = a.agentId ?? a.agentEmail ?? 'unknown'
      let acc = agents.get(key)
      if (!acc) {
        acc = {
          row: {
            agentId: a.agentId,
            agentEmail: a.agentEmail ?? 'Unknown',
            calls: 0,
            orders: 0,
            confirmed: 0,
            noAnswer: 0,
            wrongNumber: 0,
            postponed: 0,
            cancelled: 0,
            confirmationRate: 0,
            confirmedValueCents: 0
          },
          orders: new Set(),
          confirmedOrders: new Set()
        }
        agents.set(key, acc)
      }
      acc.row.calls++
      acc.orders.add(a.orderId)
      if (a.outcome === 'Confirmed') {
        acc.row.confirmed++
        if (!acc.confirmedOrders.has(a.orderId)) {
          acc.confirmedOrders.add(a.orderId)
          acc.row.confirmedValueCents += a.order.totalCents
        }
        confirmedOrders.set(a.orderId, a.order.totalCents)
      } else if (a.outcome === 'NoAnswer') acc.row.noAnswer++
      else if (a.outcome === 'WrongNumber') acc.row.wrongNumber++
      else if (a.outcome === 'Postponed') acc.row.postponed++
      else acc.row.cancelled++

      const date = new Date(a.createdAt.getTime() + ALGIERS_OFFSET).toISOString().slice(0, 10)
      const day = dailyMap.get(date) ?? { date, calls: 0, confirmed: 0, cancelled: 0 }
      day.calls++
      if (a.outcome === 'Confirmed') day.confirmed++
      if (a.outcome === 'Cancelled') day.cancelled++
      dailyMap.set(date, day)

      if (a.outcome === 'Cancelled' && a.reason) reasons.set(a.reason, (reasons.get(a.reason) ?? 0) + 1)
    }

    const agentRows = [...agents.values()]
      .map(({ row, orders, confirmedOrders: conf }) => ({ ...row, orders: orders.size, confirmationRate: orders.size ? conf.size / orders.size : 0 }))
      .sort((a, b) => b.confirmed - a.confirmed || b.calls - a.calls)

    // Speed to lead: time from order creation to its very first call, counted
    // only for orders whose first call ever happened inside this range.
    const ids = [...allOrders]
    const firstCalls = ids.length
      ? await this.prisma.callAttempt.groupBy({ by: ['orderId'], where: { orderId: { in: ids } }, _min: { createdAt: true } })
      : []
    const createdAtByOrder = new Map(attempts.map((a) => [a.orderId, a.order.createdAt]))
    const waits = firstCalls
      .filter((f) => f._min.createdAt && f._min.createdAt >= from && f._min.createdAt <= to)
      .map((f) => Math.max(0, (f._min.createdAt!.getTime() - createdAtByOrder.get(f.orderId)!.getTime()) / 60000))
      .sort((a, b) => a - b)
    const medianFirstCallMinutes = waits.length ? Math.round(waits[Math.floor(waits.length / 2)]!) : null

    const maxedOutOrders = await this.prisma.order.count({
      where: { archived: false, state: { in: WORK_STATES }, callAttemptsCount: { gte: CALL_CENTER_MAX_ATTEMPTS } }
    })

    const confirmedDistinct = confirmedOrders.size
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        ...totals,
        calls: attempts.length,
        orders: allOrders.size,
        confirmationRate: allOrders.size ? confirmedDistinct / allOrders.size : 0,
        confirmedValueCents: [...confirmedOrders.values()].reduce((s, v) => s + v, 0)
      },
      agents: agentRows,
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      cancelReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      medianFirstCallMinutes,
      maxedOutOrders
    }
  }
}
