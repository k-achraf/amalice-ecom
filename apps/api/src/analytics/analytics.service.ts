import { Injectable } from '@nestjs/common'
import type { AnalyticsOverview, RecordPageEngagement, RecordPageView, TopViewedItem } from '@amalice/shared'
import { deviceTypeOf, resolvePlatform } from '../orders/order-attribution.util'
import { PrismaService } from '../prisma/prisma.service'

// First-party storefront view-tracking — see PageViewEvent's Prisma model
// comment for why this exists alongside the Meta/TikTok pixels (those are
// for ad-platform attribution; this is what feeds the admin dashboard's own
// traffic numbers, which we can't pull from a third party's analytics).
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // Best-effort by design — called from every storefront page load, so it
  // must never be the reason a page fails. The controller doesn't wrap this
  // in a try/catch (a genuine DB outage should still 500 like anything
  // else), but the storefront's own fetch call is itself fire-and-forget
  // with a swallowed catch — see useViewTracking.ts.
  async recordView(input: RecordPageView, userAgent?: string): Promise<void> {
    const a = input.attribution
    const isFunnel = input.type === 'Funnel'
    await this.prisma.pageViewEvent.create({
      data: {
        ...(isFunnel && input.viewId && { id: input.viewId }),
        type: input.type,
        entityId: input.entityId ?? null,
        visitorId: input.visitorId,
        path: input.path,
        deviceType: deviceTypeOf(userAgent),
        source: isFunnel ? resolvePlatform(a) : null,
        campaign: isFunnel ? (a?.campaignName ?? a?.utmCampaign ?? null) : null
      }
    })
  }

  // Funnel visits only. The visit is found by the id the page generated and
  // must belong to the same visitor; durations/scroll only ever grow, so a
  // late or repeated beacon can't shrink what was already reported.
  async recordEngagement(input: RecordPageEngagement): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE page_view_events
      SET duration_seconds = GREATEST(COALESCE(duration_seconds, 0), ${input.seconds}),
          scroll_depth = GREATEST(COALESCE(scroll_depth, 0), ${input.scrollDepth}),
          started_form = started_form OR ${input.startedForm}
      WHERE id = ${input.viewId} AND visitor_id = ${input.visitorId} AND type = 'Funnel'`
  }

  async getOverview(days: number): Promise<AnalyticsOverview> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const baseWhere = { createdAt: { gte: since } }

    const [totalViews, distinctVisitors, homeViews, productViews, landingPageViews, topProductGroups, topLandingPageGroups] = await Promise.all([
      this.prisma.pageViewEvent.count({ where: baseWhere }),
      this.prisma.pageViewEvent.findMany({ where: baseWhere, distinct: ['visitorId'], select: { visitorId: true } }),
      this.prisma.pageViewEvent.count({ where: { ...baseWhere, type: 'Home' } }),
      this.prisma.pageViewEvent.count({ where: { ...baseWhere, type: 'Product' } }),
      this.prisma.pageViewEvent.count({ where: { ...baseWhere, type: 'LandingPage' } }),
      this.prisma.pageViewEvent.groupBy({
        by: ['entityId'],
        where: { ...baseWhere, type: 'Product', entityId: { not: null } },
        _count: { entityId: true },
        orderBy: { _count: { entityId: 'desc' } },
        take: 5
      }),
      this.prisma.pageViewEvent.groupBy({
        by: ['entityId'],
        where: { ...baseWhere, type: 'LandingPage', entityId: { not: null } },
        _count: { entityId: true },
        orderBy: { _count: { entityId: 'desc' } },
        take: 5
      })
    ])

    const productIds = topProductGroups.map((g) => g.entityId).filter((id): id is string => !!id)
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
      : []
    const productById = new Map(products.map((p) => [p.id, p]))
    const topProducts: TopViewedItem[] = topProductGroups.map((g) => ({
      id: g.entityId as string,
      name: productById.get(g.entityId as string)?.name ?? null,
      subtitle: null,
      views: g._count.entityId
    }))

    const landingPageIds = topLandingPageGroups.map((g) => g.entityId).filter((id): id is string => !!id)
    const landingPages = landingPageIds.length
      ? await this.prisma.productLandingPage.findMany({
          where: { id: { in: landingPageIds } },
          select: { id: true, name: true, number: true, product: { select: { name: true } } }
        })
      : []
    const landingPageById = new Map(landingPages.map((lp) => [lp.id, lp]))
    const topLandingPages: TopViewedItem[] = topLandingPageGroups.map((g) => {
      const lp = landingPageById.get(g.entityId as string)
      return {
        id: g.entityId as string,
        name: lp ? `${lp.name} (#${lp.number})` : null,
        subtitle: lp?.product.name ?? null,
        views: g._count.entityId
      }
    })

    return {
      days,
      totalViews,
      uniqueVisitors: distinctVisitors.length,
      homeViews,
      productViews,
      landingPageViews,
      topProducts,
      topLandingPages
    }
  }

  // ---- Visitor analysis (admin / MCP) ------------------------------------
  // One row per visitor in the window: first/last seen, pages viewed, device
  // and traffic source (from the visitor's funnel visits when there are any).
  async listVisitors(opts: { days: number; page: number; pageSize: number; source?: string; type?: string }) {
    const since = new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000)
    const where = {
      createdAt: { gte: since },
      ...(opts.source ? { source: opts.source } : {}),
      ...(opts.type ? { type: opts.type as never } : {})
    }
    const groups = await this.prisma.pageViewEvent.groupBy({
      by: ['visitorId'],
      where,
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true, durationSeconds: true, scrollDepth: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize
    })
    const total = (await this.prisma.pageViewEvent.findMany({ where, distinct: ['visitorId'], select: { visitorId: true } })).length
    const ids = groups.map((g) => g.visitorId)
    const meta = ids.length
      ? await this.prisma.pageViewEvent.findMany({
          where: { visitorId: { in: ids }, createdAt: { gte: since } },
          select: { visitorId: true, deviceType: true, source: true, campaign: true },
          orderBy: { createdAt: 'asc' }
        })
      : []
    const metaBy = new Map<string, { deviceType: string | null; source: string | null; campaign: string | null }>()
    for (const m of meta) {
      const cur = metaBy.get(m.visitorId)
      metaBy.set(m.visitorId, {
        deviceType: cur?.deviceType ?? m.deviceType,
        source: cur?.source ?? m.source,
        campaign: cur?.campaign ?? m.campaign
      })
    }
    return {
      days: opts.days,
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      items: groups.map((g) => ({
        visitorId: g.visitorId,
        views: g._count._all,
        firstSeen: g._min.createdAt,
        lastSeen: g._max.createdAt,
        maxDurationSeconds: g._max.durationSeconds,
        maxScrollDepth: g._max.scrollDepth,
        ...(metaBy.get(g.visitorId) ?? { deviceType: null, source: null, campaign: null })
      }))
    }
  }

  // One visitor's full journey: every page view in order, the funnel session
  // recordings that belong to them, and the orders they placed.
  async getVisitor(visitorId: string) {
    const [views, recordings, attributions] = await Promise.all([
      this.prisma.pageViewEvent.findMany({ where: { visitorId }, orderBy: { createdAt: 'asc' }, take: 500 }),
      this.prisma.funnelRecording.findMany({
        where: { visitorId },
        orderBy: { startedAt: 'asc' },
        take: 50,
        select: { id: true, funnelId: true, eventCount: true, startedAt: true, endedAt: true }
      }),
      this.prisma.orderAttribution.findMany({
        where: { visitorId },
        select: { order: { select: { id: true, number: true, state: true, totalCents: true, createdAt: true } }, platform: true, campaignName: true, utmSource: true }
      })
    ])
    return {
      visitorId,
      views,
      recordings,
      orders: attributions.map((a) => ({ ...a.order, platform: a.platform, campaignName: a.campaignName, utmSource: a.utmSource }))
    }
  }
}
