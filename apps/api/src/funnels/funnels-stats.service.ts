import { Injectable, NotFoundException } from '@nestjs/common'
import { suggestFunnelTests, type FunnelStats, type FunnelStatsBreakdownRow, type FunnelSuggestionResult } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { addOrder, emptyAcc, finalize } from '../meta-ads/meta-orders.util'

// A visit that lasted less than this, never scrolled a quarter of the page and never touched the
// order form is a bounce.
const ENGAGED_SECONDS = 10
const ENGAGED_SCROLL = 25
// Day boundaries in the shop's time zone (Algeria).
const TZ = 'Africa/Algiers'

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null)

interface VisitRow {
  views: number
  visitors: number
  tracked: number
  avg_duration: number | null
  avg_scroll: number | null
  bounced: number
  form_starts: number
  form_visitors: number
}

interface DayRow { day: string; views: number; visitors: number }
interface GroupRow { key: string | null; visitors: number }

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Traffic + sales numbers of one funnel for the admin "Stats" tab.
@Injectable()
export class FunnelsStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(funnelId: string, days: number): Promise<FunnelStats> {
    const funnel = await this.prisma.funnel.findUnique({ where: { id: funnelId }, select: { id: true } })
    if (!funnel) throw new NotFoundException('Funnel not found')
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [visitRows, dayRows, deviceRows, sourceRows, campaignRows, orders, products] = await Promise.all([
      this.prisma.$queryRaw<VisitRow[]>`
        SELECT COUNT(*)::int AS views,
               COUNT(DISTINCT visitor_id)::int AS visitors,
               COUNT(*) FILTER (WHERE duration_seconds IS NOT NULL)::int AS tracked,
               AVG(duration_seconds)::float AS avg_duration,
               AVG(scroll_depth) FILTER (WHERE duration_seconds IS NOT NULL)::float AS avg_scroll,
               COUNT(*) FILTER (WHERE duration_seconds IS NOT NULL AND duration_seconds < ${ENGAGED_SECONDS}
                                AND COALESCE(scroll_depth, 0) < ${ENGAGED_SCROLL} AND NOT started_form)::int AS bounced,
               COUNT(*) FILTER (WHERE started_form)::int AS form_starts,
               COUNT(DISTINCT visitor_id) FILTER (WHERE started_form)::int AS form_visitors
        FROM page_view_events
        WHERE type = 'Funnel' AND entity_id = ${funnelId} AND created_at >= ${since}`,
      this.prisma.$queryRaw<DayRow[]>`
        SELECT to_char(date_trunc('day', (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM page_view_events
        WHERE type = 'Funnel' AND entity_id = ${funnelId} AND created_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.visitorsBy(funnelId, since, 'device_type'),
      this.visitorsBy(funnelId, since, 'source'),
      this.visitorsBy(funnelId, since, 'campaign'),
      this.prisma.order.findMany({
        where: { funnelId, isAbandoned: false, archived: false, createdAt: { gte: since } },
        select: {
          state: true,
          totalCents: true,
          createdAt: true,
          address: { select: { region: true } },
          attribution: { select: { platform: true, deviceType: true, campaignName: true, utmCampaign: true } },
          items: { select: { quantity: true, productId: true, isUpsell: true, lineTotalCents: true } },
          shipment: { select: { carrierFeeCents: true, returnFeeCents: true } }
        }
      }),
      this.prisma.product.findMany({
        where: { orderItems: { some: { order: { funnelId, createdAt: { gte: since } } } } },
        select: { id: true, costCents: true }
      })
    ])
    const visit = visitRows[0]

    const costById = new Map(products.map((p) => [p.id, p.costCents]))
    const acc = emptyAcc()
    let grossCents = 0
    let withUpsell = 0
    let upsellCents = 0
    const dayOrders = new Map<string, number>()
    const wilayas = new Map<string, number>()
    const ordersBy = { device: new Map<string, number>(), source: new Map<string, number>(), campaign: new Map<string, number>() }
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

    for (const o of orders) {
      addOrder(acc, {
        state: o.state,
        totalCents: o.totalCents,
        productCostCents: o.items.reduce((sum, i) => sum + (costById.get(i.productId) ?? 0) * i.quantity, 0),
        carrierFeeCents: o.shipment?.carrierFeeCents ?? null,
        returnFeeCents: o.shipment?.returnFeeCents ?? null
      })
      grossCents += o.totalCents
      const upsell = o.items.filter((i) => i.isUpsell)
      if (upsell.length) {
        withUpsell += 1
        upsellCents += upsell.reduce((s, i) => s + i.lineTotalCents, 0)
      }
      bump(dayOrders, dayKey(o.createdAt))
      if (o.address.region) bump(wilayas, o.address.region)
      bump(ordersBy.device, o.attribution?.deviceType ?? 'unknown')
      bump(ordersBy.source, o.attribution?.platform ?? 'Direct')
      const campaign = o.attribution?.campaignName ?? o.attribution?.utmCampaign
      if (campaign) bump(ordersBy.campaign, campaign)
    }

    const views = visit?.views ?? 0
    const visitors = visit?.visitors ?? 0
    const formVisitors = visit?.form_visitors ?? 0
    const tracked = visit?.tracked ?? 0

    // One row per day of the window, so the chart has no gaps.
    const byDay = new Map(dayRows.map((r) => [r.day, r]))
    const daily = Array.from({ length: days }, (_, i) => {
      const date = dayKey(new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000))
      const r = byDay.get(date)
      return { date, views: r?.views ?? 0, visitors: r?.visitors ?? 0, orders: dayOrders.get(date) ?? 0 }
    })

    const breakdown = (rows: GroupRow[], placed: Map<string, number>, limit: number): FunnelStatsBreakdownRow[] => {
      const visitorsOf = new Map(rows.map((r) => [r.key ?? 'unknown', r.visitors]))
      const keys = new Set([...visitorsOf.keys(), ...placed.keys()])
      return [...keys]
        .map((key) => {
          const v = visitorsOf.get(key) ?? 0
          const n = placed.get(key) ?? 0
          return { key, visitors: v, orders: n, conversionRate: pct(n, v) }
        })
        .sort((a, b) => b.visitors + b.orders - (a.visitors + a.orders))
        .slice(0, limit)
    }

    return {
      days,
      traffic: {
        views,
        uniqueVisitors: visitors,
        trackedVisits: tracked,
        avgDurationSeconds: visit?.avg_duration ?? null,
        avgScrollDepth: visit?.avg_scroll ?? null,
        bounceRate: pct(visit?.bounced ?? 0, tracked),
        formStarts: visit?.form_starts ?? 0,
        formStartRate: pct(visit?.form_starts ?? 0, views)
      },
      sales: {
        orders: orders.length,
        conversionRate: pct(orders.length, visitors),
        conversionPerView: pct(orders.length, views),
        grossValue: grossCents / 100,
        avgOrderValue: orders.length ? grossCents / 100 / orders.length : null,
        ordersWithUpsell: withUpsell,
        upsellRate: pct(withUpsell, orders.length),
        upsellRevenue: upsellCents / 100,
        formDropOffRate: formVisitors > 0 ? Math.max(0, ((formVisitors - orders.length) / formVisitors) * 100) : null
      },
      fulfilment: finalize(acc, null),
      daily,
      devices: breakdown(deviceRows, ordersBy.device, 5),
      sources: breakdown(sourceRows, ordersBy.source, 8),
      campaigns: breakdown(campaignRows.filter((r) => r.key), ordersBy.campaign, 10),
      wilayas: [...wilayas].map(([key, n]) => ({ key, orders: n })).sort((a, b) => b.orders - a.orders).slice(0, 10)
    }
  }

  // The next A/B test to run, picked by rules over this funnel's own stats (see
  // packages/shared funnel-suggestions.ts). Pure arithmetic: no AI call, no quota.
  async nextTest(funnelId: string, days: number): Promise<FunnelSuggestionResult> {
    const [stats, steps] = await Promise.all([
      this.stats(funnelId, days),
      this.prisma.funnelStep.findMany({ where: { funnelId }, select: { type: true, enabled: true } })
    ])
    return suggestFunnelTests(stats, steps)
  }

  // Distinct visitors of the funnel grouped by one of the visit columns (fixed set, never user input).
  private visitorsBy(funnelId: string, since: Date, column: 'device_type' | 'source' | 'campaign') {
    return this.prisma.$queryRawUnsafe<GroupRow[]>(
      `SELECT ${column} AS key, COUNT(DISTINCT visitor_id)::int AS visitors
       FROM page_view_events
       WHERE type = 'Funnel' AND entity_id = $1 AND created_at >= $2
       GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
      funnelId,
      since
    )
  }
}
