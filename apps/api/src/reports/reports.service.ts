import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MetaAdsService } from '../meta-ads/meta-ads.service'
import { AiInsightService } from '../ai/ai-insight.service'
import { ReportSettingsService } from './report-settings.service'
import { TelegramService, escapeHtml } from './telegram.service'
import type { ReportSettings } from '../generated/prisma/client'

const ALGIERS_OFFSET_MS = 3600_000 // Algeria is UTC+1 all year
const DELIVERED = ['Delivered', 'CashCollected', 'Reconciled', 'Settled'] as const
const RETURNED = ['ReturnedToOrigin', 'Restocked'] as const
const IN_TRANSIT = ['HandedToCourier', 'OutForDelivery'] as const

const dzd = (n: number) => `${Math.round(n).toLocaleString('en-US')} DZD`

// Algiers calendar day containing `at`: [start, end) as UTC instants, its YYYY-MM-DD label and the current hour there.
export function algiersDay(at = new Date()): { start: Date; end: Date; label: string; hour: number } {
  const local = new Date(at.getTime() + ALGIERS_OFFSET_MS)
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return { start: new Date(startLocal - ALGIERS_OFFSET_MS), end: new Date(startLocal + 86_400_000 - ALGIERS_OFFSET_MS), label: new Date(startLocal).toISOString().slice(0, 10), hour: local.getUTCHours() }
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: ReportSettingsService,
    private readonly telegram: TelegramService,
    private readonly metaAds: MetaAdsService,
    private readonly insights: AiInsightService
  ) {}

  private async sendTo(s: ReportSettings, text: string): Promise<void> {
    if (!s.telegramBotToken || !s.telegramChatId) return
    await this.telegram.send(s.telegramBotToken, s.telegramChatId, text)
  }

  // True the first time a key is seen — makes each alert fire once per subject per day.
  private async once(key: string): Promise<boolean> {
    const res = await this.prisma.alertLog.createMany({ data: [{ key }], skipDuplicates: true })
    return res.count === 1
  }

  async sendTest(): Promise<void> {
    const s = await this.settings.get()
    if (!s.telegramBotToken || !s.telegramChatId) throw new BadRequestException('Telegram is not configured')
    await this.sendTo(s, '✅ <b>Amalice</b>: Telegram is connected. Daily reports and alerts will arrive here.')
  }

  // ---- daily summary ----

  async buildDailyReport(at = new Date()): Promise<string> {
    const day = algiersDay(at)
    const inDay = { gte: day.start, lt: day.end }

    const [created, transitions, products, calls] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: inDay, isAbandoned: false } }),
      this.prisma.auditLog.findMany({ where: { entity: 'Order', action: 'StateTransition', createdAt: inDay }, select: { entityId: true, metadata: true } }),
      this.prisma.product.findMany({ select: { name: true, stockQuantity: true, lowStockThreshold: true } }),
      this.prisma.callAttempt.findMany({ where: { createdAt: inDay }, select: { agentEmail: true, toState: true } })
    ])

    const toState = (m: unknown) => (m && typeof m === 'object' ? ((m as { to?: string }).to ?? null) : null)
    const idsTo = (states: readonly string[]) => new Set(transitions.filter((t) => states.includes(toState(t.metadata) ?? '')).map((t) => t.entityId))
    const confirmedIds = idsTo(['Confirmed'])
    const deliveredIds = idsTo(DELIVERED)
    const returnedIds = idsTo(RETURNED)
    const cancelledIds = idsTo(['Cancelled', 'CancelledShipping'])

    const deliveredRows = deliveredIds.size ? await this.prisma.order.findMany({ where: { id: { in: [...deliveredIds] } }, select: { totalCents: true } }) : []
    const revenue = deliveredRows.reduce((s, o) => s + o.totalCents, 0) / 100

    const lines = [
      `📊 <b>Daily report — ${day.label}</b>`,
      '',
      `🆕 New orders: <b>${created}</b>`,
      `✅ Confirmed: <b>${confirmedIds.size}</b>   ❌ Cancelled: <b>${cancelledIds.size}</b>`,
      `📦 Delivered: <b>${deliveredIds.size}</b> (${dzd(revenue)})`,
      `↩️ Returned: <b>${returnedIds.size}</b>`
    ]

    const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold).sort((a, b) => a.stockQuantity - b.stockQuantity)
    if (low.length) {
      lines.push('', `⚠️ <b>Low stock (${low.length})</b>`)
      for (const p of low.slice(0, 8)) lines.push(`• ${escapeHtml(p.name)}: ${p.stockQuantity}`)
      if (low.length > 8) lines.push(`… and ${low.length - 8} more`)
    }

    const byAgent = new Map<string, { calls: number; confirmed: number }>()
    for (const c of calls) {
      const key = c.agentEmail ?? 'unknown'
      const a = byAgent.get(key) ?? { calls: 0, confirmed: 0 }
      a.calls++
      if (c.toState === 'Confirmed') a.confirmed++
      byAgent.set(key, a)
    }
    if (byAgent.size) {
      lines.push('', '🎧 <b>Call center</b>')
      for (const [email, a] of [...byAgent].sort((x, y) => y[1].confirmed - x[1].confirmed)) {
        lines.push(`• ${escapeHtml(email.split('@')[0]!)}: ${a.calls} calls, ${a.confirmed} confirmed (${Math.round((a.confirmed / a.calls) * 100)}%)`)
      }
    }

    // Best-effort AI paragraph (null when AI is off/unavailable): never blocks the report.
    const insight = await this.insights.dailyInsight({
      date: day.label,
      created,
      confirmed: confirmedIds.size,
      cancelled: cancelledIds.size,
      delivered: deliveredIds.size,
      returned: returnedIds.size,
      revenueDzd: Math.round(revenue)
    })
    if (insight) lines.push('', '🤖 <b>AI insight</b>', escapeHtml(insight.insight), `💡 ${escapeHtml(insight.suggestion)}`)
    return lines.join('\n')
  }

  async sendDailyReport(): Promise<void> {
    const s = await this.settings.get()
    if (!s.telegramBotToken || !s.telegramChatId) throw new BadRequestException('Telegram is not configured')
    await this.sendTo(s, await this.buildDailyReport())
  }

  // Called every few minutes: sends the summary once, in the configured Algiers hour.
  async dailyTick(): Promise<void> {
    const s = await this.settings.get()
    if (!s.enabled || !s.telegramBotToken || !s.telegramChatId) return
    const day = algiersDay()
    if (day.hour !== s.dailyReportHour) return
    const key = `daily:${day.label}`
    if (!(await this.once(key))) return
    try {
      await this.sendTo(s, await this.buildDailyReport())
    } catch (error) {
      await this.prisma.alertLog.delete({ where: { key } }).catch(() => undefined)
      throw error
    }
    await this.prisma.alertLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } })
  }

  // ---- alerts ----

  async alertsTick(): Promise<void> {
    const s = await this.settings.get()
    if (!s.enabled || !s.telegramBotToken || !s.telegramChatId) return
    const label = algiersDay().label
    const messages: string[] = []
    for (const run of [() => this.costPerOrderAlerts(s, label), () => this.returnRateAlerts(s, label), () => this.carrierStaleAlerts(s, label)]) {
      try {
        messages.push(...(await run()))
      } catch (error) {
        this.logger.warn(`Alert check failed: ${(error as Error).message}`)
      }
    }
    for (const m of messages) await this.sendTo(s, m).catch((e: Error) => this.logger.warn(`Telegram alert failed: ${e.message}`))
  }

  // Today's ad spend per Meta campaign vs. the number of orders it produced.
  private async costPerOrderAlerts(s: ReportSettings, label: string): Promise<string[]> {
    const max = s.maxCostPerOrderDzd
    if (!max) return []
    const out: string[] = []
    const connections = await this.prisma.metaConnection.findMany({ where: { status: 'Active', selectedAdAccountId: { not: null } }, select: { adminUserId: true, selectedAdAccountId: true } })
    for (const c of connections) {
      let res
      try {
        res = await this.metaAds.profitability(c.adminUserId, c.selectedAdAccountId!, { level: 'campaign', datePreset: 'today' })
      } catch (error) {
        this.logger.warn(`Cost-per-order check skipped for ${c.selectedAdAccountId}: ${(error as Error).message}`)
        continue
      }
      for (const row of res.rows) {
        const spend = row.stats.adSpend
        if (spend === null) continue
        const orders = row.stats.orders
        const cpo = orders > 0 ? spend / orders : null
        // With orders: too expensive per order. Without: spent more than one order is allowed to cost.
        if (cpo !== null ? cpo <= max : spend < max) continue
        if (!(await this.once(`cpo:${label}:${row.id}`))) continue
        out.push(
          `🚨 <b>Cost per order too high</b>\nCampaign: ${escapeHtml(row.name)}\nSpend today: ${dzd(spend)} • Orders: ${orders}\n` +
            (cpo !== null ? `Cost per order: <b>${dzd(cpo)}</b> (limit ${dzd(max)})` : `No order yet after spending more than the limit of ${dzd(max)} per order`)
        )
      }
    }
    return out
  }

  // Wilayas whose 30-day return rate crossed the threshold.
  private async returnRateAlerts(s: ReportSettings, label: string): Promise<string[]> {
    const rows = await this.prisma.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, state: { in: [...DELIVERED, ...RETURNED] }, isAbandoned: false },
      select: { state: true, address: { select: { region: true } } }
    })
    const byRegion = new Map<string, { delivered: number; returned: number }>()
    for (const r of rows) {
      const k = r.address.region
      const a = byRegion.get(k) ?? { delivered: 0, returned: 0 }
      if ((RETURNED as readonly string[]).includes(r.state)) a.returned++
      else a.delivered++
      byRegion.set(k, a)
    }
    const out: string[] = []
    for (const [region, a] of byRegion) {
      const closed = a.delivered + a.returned
      const pct = (a.returned / closed) * 100
      if (closed < s.returnRateMinOrders || pct < s.returnRateAlertPct) continue
      if (!(await this.once(`ret:${label}:${region}`))) continue
      out.push(`↩️ <b>High returns in ${escapeHtml(region)}</b>\n${a.returned} of ${closed} closed orders returned (${Math.round(pct)}%) over the last 30 days. Limit: ${s.returnRateAlertPct}%.`)
    }
    return out
  }

  // Couriers that haven't touched any in-transit parcel for a while.
  private async carrierStaleAlerts(s: ReportSettings, label: string): Promise<string[]> {
    if (s.carrierStaleHours <= 0) return []
    const shipments = await this.prisma.shipment.findMany({
      where: { order: { state: { in: [...IN_TRANSIT] } } },
      select: { updatedAt: true, courier: { select: { id: true, name: true } } }
    })
    const byCourier = new Map<string, { name: string; count: number; latest: number }>()
    for (const sh of shipments) {
      const a = byCourier.get(sh.courier.id) ?? { name: sh.courier.name, count: 0, latest: 0 }
      a.count++
      a.latest = Math.max(a.latest, sh.updatedAt.getTime())
      byCourier.set(sh.courier.id, a)
    }
    const out: string[] = []
    for (const [id, a] of byCourier) {
      const hours = (Date.now() - a.latest) / 3600_000
      if (hours < s.carrierStaleHours) continue
      if (!(await this.once(`stale:${label}:${id}`))) continue
      out.push(`⏱ <b>${escapeHtml(a.name)} stopped updating statuses</b>\n${a.count} parcel(s) in transit, none updated for ${Math.round(hours)}h. Check the courier's webhook or refresh the statuses.`)
    }
    return out
  }
}
