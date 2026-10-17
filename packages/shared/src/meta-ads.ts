import { z } from 'zod'

// Meta Ads section of the admin (phase 1: read-only). An admin links their
// Facebook account through OAuth, we sync the ad accounts they can access and
// then read an account's campaigns + insights live from Meta's Graph API.
// The user access token never leaves the API (stored encrypted).

export const META_ADS_SCOPES = ['ads_read', 'business_management'] as const

// Meta's `date_preset` values we expose in the UI.
export const META_DATE_PRESETS = ['today', 'yesterday', 'last_3d', 'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month', 'maximum'] as const
export const MetaDatePresetSchema = z.enum(META_DATE_PRESETS)
export type MetaDatePreset = z.infer<typeof MetaDatePresetSchema>

export const META_DATE_PRESET_LABELS: Record<MetaDatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_3d: 'Last 3 days',
  last_7d: 'Last 7 days',
  last_14d: 'Last 14 days',
  last_30d: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  maximum: 'All time'
}

// effective_status values for the campaign filter.
export const META_CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const
export const MetaCampaignStatusSchema = z.enum(META_CAMPAIGN_STATUSES)
export type MetaCampaignStatus = z.infer<typeof MetaCampaignStatusSchema>

// account_status codes from Meta's Ad Account API.
export const META_ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: 'Active',
  2: 'Disabled',
  3: 'Unsettled',
  7: 'Pending review',
  8: 'Pending settlement',
  9: 'In grace period',
  100: 'Pending closure',
  101: 'Closed',
  201: 'Any active',
  202: 'Any closed'
}

export const MetaOAuthUrlQuerySchema = z.object({
  redirectUri: z.url().max(500),
  state: z.string().min(8).max(200)
})
export type MetaOAuthUrlQuery = z.infer<typeof MetaOAuthUrlQuerySchema>

export const ConnectMetaSchema = z.object({
  code: z.string().min(1).max(2000),
  redirectUri: z.url().max(500)
})
export type ConnectMeta = z.infer<typeof ConnectMetaSchema>

// Paste-a-token connection: no Facebook Login setup needed. The token comes from
// Graph API Explorer (user token) or a Business Manager System User.
export const ConnectMetaTokenSchema = z.object({
  accessToken: z.string().trim().min(20).max(1000)
})
export type ConnectMetaToken = z.infer<typeof ConnectMetaTokenSchema>

// The Meta developer app used by "Connect with Facebook". appSecret may be
// omitted to keep the saved one (it is never sent back to the browser).
export const SaveMetaAppCredentialsSchema = z.object({
  appId: z.string().trim().regex(/^\d{5,25}$/, 'The App ID is a number'),
  appSecret: z.string().trim().min(16).max(200).optional()
})
export type SaveMetaAppCredentials = z.infer<typeof SaveMetaAppCredentialsSchema>

export const MetaCampaignsQuerySchema = z.object({
  datePreset: MetaDatePresetSchema.default('last_7d'),
  status: MetaCampaignStatusSchema.optional(),
  after: z.string().max(500).optional(),
  // '1' / 'true' bypasses the short server-side cache.
  refresh: z.enum(['1', 'true']).optional()
})
export type MetaCampaignsQuery = z.infer<typeof MetaCampaignsQuerySchema>

export const MetaInsightsQuerySchema = z.object({
  datePreset: MetaDatePresetSchema.default('last_7d'),
  // '1' / 'true' bypasses the short server-side cache.
  refresh: z.enum(['1', 'true']).optional()
})
export type MetaInsightsQuery = z.infer<typeof MetaInsightsQuerySchema>

export interface MetaAppCredentialsView {
  appId: string
  appName: string | null
  // Where the credentials come from: saved from the admin UI, or the API's env fallback.
  source: 'database' | 'env'
}

export interface MetaConnectionView {
  fbUserId: string
  fbUserName: string | null
  scopes: string[]
  status: 'Active' | 'Expired'
  tokenExpiresAt: string | null
  selectedAdAccountId: string | null
  connectedAt: string
  // How the account was linked.
  method: 'oauth' | 'token'
}

// GET /admin/meta-ads/status
export interface MetaAdsStatus {
  // True when a Meta app (id + secret) is set, which "Connect with Facebook" needs.
  // Connecting with an access token works without it.
  configured: boolean
  app: MetaAppCredentialsView | null
  connection: MetaConnectionView | null
}

export interface MetaAdAccountView {
  accountId: string
  name: string
  currency: string | null
  timezoneName: string | null
  accountStatus: number
  accountStatusLabel: string
  businessName: string | null
  // Lifetime spend / balance in the account currency (major units).
  amountSpent: number | null
  balance: number | null
  // 1 unit of the account's currency in DZD (1 for DZD accounts); null = not set yet.
  exchangeRateToDzd: number | null
  syncedAt: string
}

// Numbers are in the ad account's currency (major units), exactly as Meta reports them.
export interface MetaInsightsMetrics {
  spend: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  cpc: number | null
  cpm: number | null
  // Purchases / leads reported by the pixel, and cost per purchase (null when none).
  purchases: number
  leads: number
  costPerPurchase: number | null
  purchaseValue: number
  roas: number | null
}

export interface MetaCampaignView {
  id: string
  name: string
  status: string
  effectiveStatus: string
  objective: string | null
  // Daily / lifetime budget in the account currency (major units); null when set at ad set level.
  dailyBudget: number | null
  lifetimeBudget: number | null
  startTime: string | null
  stopTime: string | null
  createdTime: string | null
  insights: MetaInsightsMetrics | null
}

export interface MetaCampaignsResponse {
  currency: string | null
  items: MetaCampaignView[]
  // Cursor for the next page, null when this is the last one.
  next: string | null
  fetchedAt: string
}

// Ad sets of one campaign. `parent` is the campaign being viewed (for the breadcrumb).
export interface MetaAdSetView {
  id: string
  name: string
  status: string
  effectiveStatus: string
  optimizationGoal: string | null
  // Daily / lifetime budget in the account currency (major units); null when set on the campaign.
  dailyBudget: number | null
  lifetimeBudget: number | null
  startTime: string | null
  endTime: string | null
  insights: MetaInsightsMetrics | null
}

export interface MetaAdSetsResponse {
  currency: string | null
  parent: { id: string; name: string }
  items: MetaAdSetView[]
  next: string | null
  fetchedAt: string
}

// Ads of one ad set. `parent` is the ad set, `campaign` its campaign (for the breadcrumb).
export interface MetaAdView {
  id: string
  name: string
  status: string
  effectiveStatus: string
  thumbnailUrl: string | null
  insights: MetaInsightsMetrics | null
}

export interface MetaAdsResponse {
  currency: string | null
  parent: { id: string; name: string }
  campaign: { id: string; name: string } | null
  items: MetaAdView[]
  next: string | null
  fetchedAt: string
}

export interface MetaAccountOverview {
  currency: string | null
  datePreset: MetaDatePreset
  totals: MetaInsightsMetrics | null
  fetchedAt: string
}

// ---- Detailed analytics of one campaign / ad set / ad ----

export const META_ANALYTICS_LEVELS = ['campaign', 'adset', 'ad'] as const
export const MetaAnalyticsLevelSchema = z.enum(META_ANALYTICS_LEVELS)
export type MetaAnalyticsLevel = z.infer<typeof MetaAnalyticsLevelSchema>

export const MetaAnalyticsQuerySchema = z.object({
  datePreset: MetaDatePresetSchema.default('last_30d'),
  refresh: z.enum(['1', 'true']).optional()
})
export type MetaAnalyticsQuery = z.infer<typeof MetaAnalyticsQuerySchema>

// Every figure of one slice of data (a whole period, one day, one age group...).
// Counts are 0 when there are none; ratios are null when their denominator is 0.
// Money is in the ad account's currency (major units).
export interface MetaAnalyticsTotals {
  spend: number
  impressions: number
  reach: number
  frequency: number | null
  clicks: number
  uniqueClicks: number
  ctr: number | null
  cpc: number | null
  cpm: number | null
  linkClicks: number
  linkCtr: number | null
  costPerLinkClick: number | null
  landingPageViews: number
  costPerLandingPageView: number | null
  viewContent: number
  addToCart: number
  costPerAddToCart: number | null
  initiateCheckout: number
  costPerInitiateCheckout: number | null
  purchases: number
  costPerPurchase: number | null
  purchaseValue: number
  roas: number | null
  // Average order value reported by the pixel.
  aov: number | null
  leads: number
  costPerLead: number | null
  // purchases / link clicks, in percent.
  conversionRate: number | null
  engagement: { postEngagement: number; reactions: number; comments: number; shares: number; saves: number }
  video: { plays: number; p25: number; p50: number; p75: number; p100: number; thruplays: number; avgWatchSeconds: number | null }
}

export type MetaAnalyticsDay = { date: string } & Pick<
  MetaAnalyticsTotals,
  'spend' | 'impressions' | 'reach' | 'clicks' | 'linkClicks' | 'ctr' | 'cpc' | 'cpm' | 'frequency' | 'addToCart' | 'initiateCheckout' | 'purchases' | 'costPerPurchase' | 'purchaseValue' | 'roas' | 'leads'
>

export interface MetaBreakdownRow {
  key: string
  label: string
  // Only for the age x gender matrix.
  age?: string
  gender?: string
  metrics: MetaAnalyticsTotals
}

export interface MetaAnalyticsBreakdowns {
  age?: MetaBreakdownRow[]
  gender?: MetaBreakdownRow[]
  ageGender?: MetaBreakdownRow[]
  // Algerian wilaya (Meta "region") for local campaigns.
  region?: MetaBreakdownRow[]
  publisher?: MetaBreakdownRow[]
  placement?: MetaBreakdownRow[]
  device?: MetaBreakdownRow[]
  impressionDevice?: MetaBreakdownRow[]
}

export interface MetaAnalyticsEntity {
  id: string
  name: string
  status: string
  effectiveStatus: string
  objective: string | null
  optimizationGoal: string | null
  dailyBudget: number | null
  lifetimeBudget: number | null
  startTime: string | null
  endTime: string | null
  // Ad level: the creative.
  thumbnailUrl: string | null
  creativeTitle: string | null
  creativeBody: string | null
  // Ad set level: a one-line summary of who it targets.
  targeting: string | null
  campaign: { id: string; name: string } | null
  adset: { id: string; name: string } | null
}

export interface MetaAnalyticsChild {
  id: string
  name: string
  metrics: MetaAnalyticsTotals
  // Orders linked to this ad set / ad (null when they couldn't be read).
  orders: MetaOrderStats | null
}

export interface MetaAnalyticsResponse {
  level: MetaAnalyticsLevel
  currency: string | null
  timezone: string | null
  datePreset: MetaDatePreset
  // Inclusive dates (YYYY-MM-DD) in the ad account's timezone; the previous period has the same length.
  range: { since: string; until: string } | null
  previousRange: { since: string; until: string } | null
  entity: MetaAnalyticsEntity
  totals: MetaAnalyticsTotals | null
  previous: MetaAnalyticsTotals | null
  daily: MetaAnalyticsDay[]
  // Same length as the previous range, for the "compare" overlay (empty when there is none).
  previousDaily: MetaAnalyticsDay[]
  breakdowns: MetaAnalyticsBreakdowns
  // Ad sets of a campaign / ads of an ad set (none for an ad).
  childLevel: 'adset' | 'ad' | null
  children: MetaAnalyticsChild[]
  // Orders linked to this campaign / ad set / ad: statuses, rates, revenue and profit (null when unavailable).
  orders: MetaOrderStats | null
  // 1 account-currency unit in DZD (null = not set), for profit figures.
  exchangeRateToDzd: number | null
  // Ad level only: Meta's relevance diagnostics (e.g. ABOVE_AVERAGE).
  rankings: { quality: string | null; engagement: string | null; conversion: string | null } | null
  fetchedAt: string
}

// ---- Orders linked to ads: confirmation / delivery / return rates and profit ----
//
// Orders are linked to a campaign / ad set / ad through their OrderAttribution (ids from the
// ad's URL parameters, else a unique name match on utm_campaign / utm_term / utm_content).
// Definitions (all rates in percent):
//   confirmed          = the call center confirmed it (also if it was cancelled afterwards)
//   confirmationRate   = confirmed / orders
//   deliveryRate       = delivered / confirmed          returnRate = returned / confirmed
//   finalDeliveryRate  = delivered / (delivered + returned)   (ignores orders still in transit)
//   revenue            = total of delivered orders (cash collected, shipping included)
//   profit             = revenue - product cost - courier fees - ad spend   (negative = loss)
// Money is in DZD (major units).

export const MetaProfitabilityQuerySchema = z.object({
  level: MetaAnalyticsLevelSchema.default('campaign'),
  datePreset: MetaDatePresetSchema.default('last_30d'),
  refresh: z.enum(['1', 'true']).optional()
})
export type MetaProfitabilityQuery = z.infer<typeof MetaProfitabilityQuerySchema>

export const SetMetaExchangeRateSchema = z.object({
  // 1 unit of the ad account's currency in DZD (e.g. 1 USD = 245).
  rate: z.number().positive().max(100000).nullable()
})
export type SetMetaExchangeRate = z.infer<typeof SetMetaExchangeRateSchema>

export interface MetaOrderStats {
  orders: number
  // Waiting for / failing the confirmation call.
  pending: number
  cancelledByCallCenter: number
  confirmed: number
  // Confirmed, not delivered / returned / cancelled yet.
  inProgress: number
  delivered: number
  returned: number
  cancelledAfterConfirm: number
  confirmationRate: number | null
  deliveryRate: number | null
  returnRate: number | null
  finalDeliveryRate: number | null
  revenue: number
  inProgressValue: number
  returnedValue: number
  productCost: number
  courierFees: number
  grossProfit: number
  // In DZD; null while the ad account has no exchange rate.
  adSpend: number | null
  profit: number | null
  // profit / ad spend, in percent.
  roi: number | null
  // revenue / ad spend.
  realRoas: number | null
  costPerOrder: number | null
  costPerDelivered: number | null
}

export interface MetaProfitabilityRow {
  id: string
  name: string
  status: string | null
  // Ad spend in the ad account's currency (as Meta reports it).
  spendAccountCurrency: number
  stats: MetaOrderStats
}

export interface MetaProfitabilityResponse {
  level: MetaAnalyticsLevel
  datePreset: MetaDatePreset
  // Inclusive dates in the ad account's timezone; null = all time.
  range: { since: string; until: string } | null
  accountCurrency: string | null
  // 1 account-currency unit in DZD (1 for a DZD account); null = not set yet.
  exchangeRateToDzd: number | null
  rows: MetaProfitabilityRow[]
  totals: MetaOrderStats
  // Meta-attributed orders that couldn't be tied to any entity (no ids and no unique name match).
  unlinkedOrders: number
  warnings: string[]
  fetchedAt: string
}
