import type { MetaAnalyticsDay, MetaAnalyticsTotals } from '@amalice/shared'
import { formatCount, formatMoney } from '~/composables/useMetaAds'

// The figures of the analytics page: how each is read from a totals/day object, formatted,
// and whether a lower value is the better one (costs) — used for the delta colors.
export type MetricKind = 'money' | 'count' | 'pct' | 'ratio' | 'mult'

export interface AnalyticsMetric {
  key: string
  label: string
  kind: MetricKind
  lowerIsBetter?: boolean
  // Also available per day (the time chart's selector).
  daily?: boolean
  get: (t: MetaAnalyticsTotals | MetaAnalyticsDay) => number | null
}

const g = (key: string) => (t: MetaAnalyticsTotals | MetaAnalyticsDay) => {
  const v = (t as unknown as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : null
}

export const ANALYTICS_METRICS: AnalyticsMetric[] = [
  { key: 'spend', label: 'Spend', kind: 'money', daily: true, get: g('spend') },
  { key: 'impressions', label: 'Impressions', kind: 'count', daily: true, get: g('impressions') },
  { key: 'reach', label: 'Reach', kind: 'count', daily: true, get: g('reach') },
  { key: 'frequency', label: 'Frequency', kind: 'ratio', lowerIsBetter: true, daily: true, get: g('frequency') },
  { key: 'clicks', label: 'Clicks (all)', kind: 'count', daily: true, get: g('clicks') },
  { key: 'linkClicks', label: 'Link clicks', kind: 'count', daily: true, get: g('linkClicks') },
  { key: 'ctr', label: 'CTR', kind: 'pct', daily: true, get: g('ctr') },
  { key: 'cpc', label: 'CPC', kind: 'money', lowerIsBetter: true, daily: true, get: g('cpc') },
  { key: 'cpm', label: 'CPM', kind: 'money', lowerIsBetter: true, daily: true, get: g('cpm') },
  { key: 'landingPageViews', label: 'Landing page views', kind: 'count', get: g('landingPageViews') },
  { key: 'addToCart', label: 'Add to cart', kind: 'count', daily: true, get: g('addToCart') },
  { key: 'initiateCheckout', label: 'Checkouts started', kind: 'count', daily: true, get: g('initiateCheckout') },
  { key: 'purchases', label: 'Purchases', kind: 'count', daily: true, get: g('purchases') },
  { key: 'costPerPurchase', label: 'Cost per purchase', kind: 'money', lowerIsBetter: true, daily: true, get: g('costPerPurchase') },
  { key: 'purchaseValue', label: 'Purchase value', kind: 'money', daily: true, get: g('purchaseValue') },
  { key: 'roas', label: 'ROAS', kind: 'mult', daily: true, get: g('roas') },
  { key: 'aov', label: 'Avg. order value', kind: 'money', get: g('aov') },
  { key: 'conversionRate', label: 'Conversion rate', kind: 'pct', get: g('conversionRate') },
  { key: 'leads', label: 'Leads', kind: 'count', daily: true, get: g('leads') }
]

export const metricByKey = (key: string) => ANALYTICS_METRICS.find((m) => m.key === key)!

export function formatMetric(m: AnalyticsMetric, v: number | null | undefined, currency: string | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  switch (m.kind) {
    case 'money': return formatMoney(v, currency)
    case 'count': return formatCount(v)
    case 'pct': return `${v.toFixed(2)}%`
    case 'mult': return `${v.toFixed(2)}×`
    default: return v.toFixed(2)
  }
}

// Change vs the previous period, in percent; null when there is nothing to compare.
export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
