import { z } from 'zod'

// Order → ad attribution. Every new order records where the customer came
// from: the ad platform, the campaign / ad set / ad when the ad's URL carries
// them, click ids, the ad-pixel cookies, the landing page, the referrer and
// the request's IP / user agent. All of it is best-effort and optional — a
// missing or malformed value never blocks an order (see OrdersService.
// recordAttribution), it just leaves the order less attributable.
//
// For the campaign / ad set / ad ids to be known, the ad's URL parameters
// must carry them, e.g. for Meta:
//   utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}
//   &utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}
//   &adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
// and for TikTok: ttclid=__CLICKID__&campaign_id=__CAMPAIGN_ID__&adset_id=
// __AID__&ad_id=__CID__ (plus the utm_* names). Without them the order still
// records the platform (from fbclid / ttclid / gclid / utm_source / referrer).

export const AttributionPlatformSchema = z.enum(['Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct'])
export type AttributionPlatform = z.infer<typeof AttributionPlatformSchema>

export const ATTRIBUTION_PLATFORM_LABELS: Record<AttributionPlatform, string> = {
  Meta: 'Meta (Facebook / Instagram)',
  TikTok: 'TikTok',
  Google: 'Google',
  Snapchat: 'Snapchat',
  Other: 'Other campaign',
  Organic: 'Organic (social / search)',
  Direct: 'Direct'
}

export const AttributionChannelSchema = z.enum(['storefront', 'landing_page', 'funnel', 'pos'])
export type AttributionChannel = z.infer<typeof AttributionChannelSchema>

const s = (max: number) => z.string().max(max).optional()

// What one visit's URL / referrer yielded (the "touch"). Used both for the
// order's own (last) touch and, trimmed, for the first touch.
export const AttributionTouchSchema = z.object({
  utmSource: s(200),
  utmMedium: s(200),
  utmCampaign: s(300),
  utmContent: s(300),
  utmTerm: s(300),
  campaignId: s(100),
  adsetId: s(100),
  adId: s(100),
  campaignName: s(300),
  adsetName: s(300),
  adName: s(300),
  placement: s(100),
  fbclid: s(500),
  ttclid: s(500),
  gclid: s(500),
  landingUrl: s(2000),
  referrer: s(2000),
  // Epoch ms the touch was captured in the visitor's browser.
  capturedAt: z.number().int().nonnegative().optional()
})
export type AttributionTouch = z.infer<typeof AttributionTouchSchema>

// Sent by the storefront / funnel pages inside `tracking.attribution`.
export const OrderAttributionInputSchema = AttributionTouchSchema.extend({
  channel: AttributionChannelSchema.optional(),
  // The page the order form was submitted from.
  pageUrl: s(2000),
  visitorId: s(100),
  firstTouch: AttributionTouchSchema.optional()
})
export type OrderAttributionInput = z.infer<typeof OrderAttributionInputSchema>

// Admin order detail's view of the stored attribution row.
export interface OrderAttributionView {
  platform: AttributionPlatform
  channel: AttributionChannel | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  campaignId: string | null
  adsetId: string | null
  adId: string | null
  campaignName: string | null
  adsetName: string | null
  adName: string | null
  placement: string | null
  fbclid: string | null
  ttclid: string | null
  gclid: string | null
  fbp: string | null
  fbc: string | null
  ttp: string | null
  landingUrl: string | null
  referrer: string | null
  pageUrl: string | null
  visitorId: string | null
  ipAddress: string | null
  userAgent: string | null
  deviceType: string | null
  firstTouch: AttributionTouch | null
  createdAt: string
}
