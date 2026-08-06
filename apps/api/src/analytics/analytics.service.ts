import { Injectable } from '@nestjs/common'
import type { AnalyticsOverview, RecordPageView, TopViewedItem } from '@amalice/shared'
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
  async recordView(input: RecordPageView): Promise<void> {
    await this.prisma.pageViewEvent.create({
      data: {
        type: input.type,
        entityId: input.entityId ?? null,
        visitorId: input.visitorId,
        path: input.path
      }
    })
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
}
