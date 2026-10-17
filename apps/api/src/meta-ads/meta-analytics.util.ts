import type { MetaAnalyticsDay, MetaAnalyticsTotals, MetaDatePreset } from '@amalice/shared'

interface RawAction { action_type?: string; value: string }

// What Meta returns for one insights row — only the additive base figures; every ratio is
// recomputed from them (so rows can be summed and ratios stay right).
export interface RawAnalytics {
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  unique_clicks?: string
  inline_link_clicks?: string
  actions?: RawAction[]
  action_values?: RawAction[]
  video_play_actions?: RawAction[]
  video_p25_watched_actions?: RawAction[]
  video_p50_watched_actions?: RawAction[]
  video_p75_watched_actions?: RawAction[]
  video_p100_watched_actions?: RawAction[]
  video_thruplay_watched_actions?: RawAction[]
  video_avg_time_watched_actions?: RawAction[]
  // Breakdown keys, date, ids.
  [key: string]: unknown
}

export const ANALYTICS_FIELDS = [
  'spend', 'impressions', 'reach', 'clicks', 'unique_clicks', 'inline_link_clicks', 'actions', 'action_values',
  'video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions', 'video_p75_watched_actions',
  'video_p100_watched_actions', 'video_thruplay_watched_actions', 'video_avg_time_watched_actions'
].join(',')

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const ratio = (a: number, b: number, scale = 1) => (b > 0 ? (a / b) * scale : null)

// Meta reports each result under several action types; take the first present in priority order.
function pick(list: RawAction[] | undefined, types: string[]): number {
  for (const type of types) {
    const hit = list?.find((a) => a.action_type === type)
    if (hit) return num(hit.value)
  }
  return 0
}
const first = (list: RawAction[] | undefined) => (list?.length ? num(list[0]!.value) : 0)

const PURCHASE = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase']
const LEAD = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']
const VIEW_CONTENT = ['omni_view_content', 'offsite_conversion.fb_pixel_view_content', 'view_content']
const ADD_TO_CART = ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart']
const CHECKOUT = ['omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'initiate_checkout']

export function toTotals(raw: RawAnalytics): MetaAnalyticsTotals {
  const spend = num(raw.spend)
  const impressions = num(raw.impressions)
  const reach = num(raw.reach)
  const clicks = num(raw.clicks)
  const linkClicks = num(raw.inline_link_clicks) || pick(raw.actions, ['link_click'])
  const lpv = pick(raw.actions, ['landing_page_view'])
  const addToCart = pick(raw.actions, ADD_TO_CART)
  const checkout = pick(raw.actions, CHECKOUT)
  const purchases = pick(raw.actions, PURCHASE)
  const purchaseValue = pick(raw.action_values, PURCHASE)
  const leads = pick(raw.actions, LEAD)
  const plays = first(raw.video_play_actions)
  return {
    spend,
    impressions,
    reach,
    frequency: ratio(impressions, reach),
    clicks,
    uniqueClicks: num(raw.unique_clicks),
    ctr: ratio(clicks, impressions, 100),
    cpc: ratio(spend, clicks),
    cpm: ratio(spend, impressions, 1000),
    linkClicks,
    linkCtr: ratio(linkClicks, impressions, 100),
    costPerLinkClick: ratio(spend, linkClicks),
    landingPageViews: lpv,
    costPerLandingPageView: ratio(spend, lpv),
    viewContent: pick(raw.actions, VIEW_CONTENT),
    addToCart,
    costPerAddToCart: ratio(spend, addToCart),
    initiateCheckout: checkout,
    costPerInitiateCheckout: ratio(spend, checkout),
    purchases,
    costPerPurchase: ratio(spend, purchases),
    purchaseValue,
    roas: ratio(purchaseValue, spend),
    aov: ratio(purchaseValue, purchases),
    leads,
    costPerLead: ratio(spend, leads),
    conversionRate: ratio(purchases, linkClicks, 100),
    engagement: {
      postEngagement: pick(raw.actions, ['post_engagement']),
      reactions: pick(raw.actions, ['post_reaction']),
      comments: pick(raw.actions, ['comment']),
      shares: pick(raw.actions, ['post']),
      saves: pick(raw.actions, ['onsite_conversion.post_save'])
    },
    video: {
      plays,
      p25: first(raw.video_p25_watched_actions),
      p50: first(raw.video_p50_watched_actions),
      p75: first(raw.video_p75_watched_actions),
      p100: first(raw.video_p100_watched_actions),
      thruplays: first(raw.video_thruplay_watched_actions),
      avgWatchSeconds: plays > 0 ? first(raw.video_avg_time_watched_actions) || null : null
    }
  }
}

export function toDay(raw: RawAnalytics): MetaAnalyticsDay {
  const t = toTotals(raw)
  return {
    date: String(raw.date_start ?? ''),
    spend: t.spend, impressions: t.impressions, reach: t.reach, clicks: t.clicks, linkClicks: t.linkClicks, ctr: t.ctr, cpc: t.cpc, cpm: t.cpm,
    frequency: t.frequency, addToCart: t.addToCart, initiateCheckout: t.initiateCheckout, purchases: t.purchases, costPerPurchase: t.costPerPurchase,
    purchaseValue: t.purchaseValue, roas: t.roas, leads: t.leads
  }
}

const ADDITIVE = ['spend', 'impressions', 'reach', 'clicks', 'unique_clicks', 'inline_link_clicks'] as const
const ACTION_LISTS = [
  'actions', 'action_values', 'video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions', 'video_thruplay_watched_actions'
] as const

// Sums several rows (e.g. age x gender cells into one age group). Reach is summed too: the cells of a
// breakdown are disjoint audiences. The average watch time is weighted by plays.
export function mergeRaw(rows: RawAnalytics[]): RawAnalytics {
  const out: RawAnalytics = {}
  for (const k of ADDITIVE) out[k] = String(rows.reduce((s, r) => s + num(r[k]), 0))
  for (const k of ACTION_LISTS) {
    const byType = new Map<string, number>()
    for (const r of rows) for (const a of (r[k] as RawAction[] | undefined) ?? []) byType.set(a.action_type ?? '', (byType.get(a.action_type ?? '') ?? 0) + num(a.value))
    out[k] = [...byType].map(([action_type, value]) => ({ action_type, value: String(value) }))
  }
  const plays = rows.reduce((s, r) => s + first(r.video_play_actions as RawAction[] | undefined), 0)
  const watched = rows.reduce((s, r) => s + first(r.video_play_actions as RawAction[] | undefined) * first(r.video_avg_time_watched_actions as RawAction[] | undefined), 0)
  out.video_avg_time_watched_actions = plays > 0 ? [{ action_type: 'video_view', value: String(watched / plays) }] : []
  return out
}

// ---- date ranges, in the ad account's timezone ----

interface Ymd { y: number; m: number; d: number }
const toDate = (v: Ymd) => new Date(Date.UTC(v.y, v.m - 1, v.d))
const fromDate = (d: Date): Ymd => ({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() })
const addDays = (v: Ymd, n: number): Ymd => fromDate(new Date(toDate(v).getTime() + n * 86_400_000))
export const fmtYmd = (v: Ymd) => `${v.y}-${String(v.m).padStart(2, '0')}-${String(v.d).padStart(2, '0')}`

function todayIn(timeZone: string | null, now: Date): Ymd {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number)
    return { y: parts[0]!, m: parts[1]!, d: parts[2]! }
  } catch {
    return fromDate(now)
  }
}

export interface DateRange { since: string; until: string }

// Meta's presets, spelled out so the previous period can be derived. "maximum" has no fixed range.
export function resolveRange(preset: MetaDatePreset, timeZone: string | null, now = new Date()): { current: DateRange; previous: DateRange } | null {
  if (preset === 'maximum') return null
  const t = todayIn(timeZone, now)
  let since: Ymd
  let until: Ymd
  switch (preset) {
    case 'today': since = until = t; break
    case 'yesterday': since = until = addDays(t, -1); break
    case 'last_3d': since = addDays(t, -3); until = addDays(t, -1); break
    case 'last_7d': since = addDays(t, -7); until = addDays(t, -1); break
    case 'last_14d': since = addDays(t, -14); until = addDays(t, -1); break
    case 'last_30d': since = addDays(t, -30); until = addDays(t, -1); break
    case 'this_month': since = { y: t.y, m: t.m, d: 1 }; until = t; break
    case 'last_month': {
      const firstThis = { y: t.y, m: t.m, d: 1 }
      until = addDays(firstThis, -1)
      since = { y: until.y, m: until.m, d: 1 }
      break
    }
  }
  const days = Math.round((toDate(until).getTime() - toDate(since).getTime()) / 86_400_000) + 1
  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))
  return { current: { since: fmtYmd(since), until: fmtYmd(until) }, previous: { since: fmtYmd(prevSince), until: fmtYmd(prevUntil) } }
}

const WORDS: Record<string, string> = {
  audience_network: 'Audience Network',
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  mobile_app: 'Mobile app',
  mobile_web: 'Mobile web',
  desktop: 'Desktop',
  iphone: 'iPhone',
  ipad: 'iPad',
  ipod: 'iPod',
  android_smartphone: 'Android phone',
  android_tablet: 'Android tablet',
  other: 'Other',
  unknown: 'Unknown',
  male: 'Men',
  female: 'Women'
}

export function prettyLabel(value: string): string {
  return WORDS[value] ?? value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
}

// ---- date range -> UTC instants (to filter orders by createdAt) ----

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(at.getTime() / 1000) * 1000
}

function startOfDayUtc(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  const guess = Date.UTC(y, m - 1, d)
  return new Date(guess - tzOffsetMs(new Date(guess), timeZone))
}

// [since 00:00, day after until 00:00) in the account's timezone, as UTC instants.
export function rangeBoundsUtc(range: DateRange, timeZone: string | null): { gte: Date; lt: Date } {
  const tz = timeZone ?? 'UTC'
  const [y, m, d] = range.until.split('-').map(Number) as [number, number, number]
  const next = fmtYmd(addDays({ y, m, d }, 1))
  try {
    return { gte: startOfDayUtc(range.since, tz), lt: startOfDayUtc(next, tz) }
  } catch {
    return { gte: new Date(`${range.since}T00:00:00Z`), lt: new Date(`${next}T00:00:00Z`) }
  }
}
