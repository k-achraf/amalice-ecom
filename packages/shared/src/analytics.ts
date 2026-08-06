import { z } from 'zod'

// First-party storefront view-tracking — our own DB, never third-party
// pixel data (Meta/TikTok pixels still fire independently for ad-platform
// attribution; this is what actually powers the admin dashboard's traffic
// numbers, since we can't query Meta/TikTok's own analytics for that). See
// PageViewEvent's Prisma model comment for the full picture.
export const PageViewTypeSchema = z.enum(['Home', 'Product', 'LandingPage', 'Other'])
export type PageViewType = z.infer<typeof PageViewTypeSchema>

// entityId is the product's or landing page's own id for those two types —
// omitted for Home/Other. visitorId is a client-generated uuid persisted in
// localStorage (useVisitorId() in the storefront), not tied to any account
// — it's what "unique views" counts distinct values of.
export const RecordPageViewSchema = z.object({
  type: PageViewTypeSchema,
  entityId: z.string().max(200).optional(),
  path: z.string().min(1).max(500),
  visitorId: z.string().min(8).max(100)
})
export type RecordPageView = z.infer<typeof RecordPageViewSchema>

export const TopViewedItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  subtitle: z.string().nullable(),
  views: z.number().int().nonnegative()
})
export type TopViewedItem = z.infer<typeof TopViewedItemSchema>

// Admin dashboard's "storefront traffic" section — a fixed lookback window
// (days), not a full analytics/reporting suite.
export const AnalyticsOverviewSchema = z.object({
  days: z.number().int().positive(),
  totalViews: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative(),
  homeViews: z.number().int().nonnegative(),
  productViews: z.number().int().nonnegative(),
  landingPageViews: z.number().int().nonnegative(),
  topProducts: z.array(TopViewedItemSchema),
  topLandingPages: z.array(TopViewedItemSchema)
})
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>
