import type { MetaInsightsMetrics } from '@amalice/shared'

// The metrics the Meta Ads pages can show, and which of them the user picked.
// The picker (components/MetaMetricPicker.vue) edits the selection; the choice is
// remembered per browser. `campaign` metrics belong to the campaign itself (not to
// its insights), so they only exist in the campaigns table.
export interface MetaMetricDef {
  key: string
  label: string
  group: 'Delivery' | 'Results' | 'Cost' | 'Campaign'
  campaign?: boolean
  // Shown as 0 (not a dash) for a campaign without delivery in the period.
  zeroWhenEmpty?: boolean
  format: (m: MetaInsightsMetrics, currency: string | null) => string
}

const money = (v: number | null, currency: string | null) => formatMoney(v, currency)
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}%`)

export const META_METRICS: MetaMetricDef[] = [
  { key: 'budget', label: 'Budget', group: 'Campaign', campaign: true, format: () => '' },
  { key: 'spend', label: 'Spend', group: 'Cost', zeroWhenEmpty: true, format: (m, c) => money(m.spend, c) },
  { key: 'impressions', label: 'Impressions', group: 'Delivery', zeroWhenEmpty: true, format: (m) => formatCount(m.impressions) },
  { key: 'reach', label: 'Reach', group: 'Delivery', zeroWhenEmpty: true, format: (m) => formatCount(m.reach) },
  { key: 'clicks', label: 'Clicks', group: 'Delivery', zeroWhenEmpty: true, format: (m) => formatCount(m.clicks) },
  { key: 'ctr', label: 'CTR', group: 'Delivery', format: (m) => pct(m.ctr) },
  { key: 'cpc', label: 'CPC', group: 'Cost', format: (m, c) => money(m.cpc, c) },
  { key: 'cpm', label: 'CPM', group: 'Cost', format: (m, c) => money(m.cpm, c) },
  { key: 'purchases', label: 'Purchases', group: 'Results', zeroWhenEmpty: true, format: (m) => formatCount(m.purchases) },
  { key: 'leads', label: 'Leads', group: 'Results', zeroWhenEmpty: true, format: (m) => formatCount(m.leads) },
  { key: 'costPerPurchase', label: 'Cost per purchase', group: 'Cost', format: (m, c) => money(m.costPerPurchase, c) },
  { key: 'purchaseValue', label: 'Purchase value', group: 'Results', zeroWhenEmpty: true, format: (m, c) => money(m.purchaseValue, c) },
  { key: 'roas', label: 'ROAS', group: 'Results', format: (m) => (m.roas ? `${m.roas.toFixed(2)}×` : '—') }
]

export const META_METRIC_GROUPS = ['Campaign', 'Cost', 'Delivery', 'Results'] as const

const DEFAULT_KEYS = ['budget', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'purchases', 'costPerPurchase', 'roas']
const STORAGE_KEY = 'amalice.metaMetrics'

// The text for one metric of one campaign (or of the account totals when `metrics` is the overview).
export function metricText(def: MetaMetricDef, metrics: MetaInsightsMetrics | null | undefined, currency: string | null): string {
  if (metrics) return def.format(metrics, currency)
  return def.zeroWhenEmpty ? def.format(EMPTY, currency) : '—'
}

const EMPTY: MetaInsightsMetrics = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: null, cpm: null, purchases: 0, leads: 0, costPerPurchase: null, purchaseValue: 0, roas: null
}

export function useMetaMetrics() {
  const selected = useState<string[]>('meta-ads-metrics', () => DEFAULT_KEYS)
  const loaded = useState('meta-ads-metrics-loaded', () => false)

  // Restores the saved choice once per page load (browser storage may be unavailable).
  if (import.meta.client && !loaded.value) {
    loaded.value = true
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as string[] | null
      const valid = saved?.filter((k) => META_METRICS.some((m) => m.key === k))
      if (valid?.length) selected.value = valid
    } catch {
      // Ignore a corrupt or blocked store; the defaults apply.
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selected.value))
    } catch {
      // Not remembered, still applied for this session.
    }
  }

  // Selected metrics in catalogue order, so columns don't jump around.
  const visible = computed(() => META_METRICS.filter((m) => selected.value.includes(m.key)))
  const isOn = (key: string) => selected.value.includes(key)

  function toggle(key: string, on: boolean) {
    selected.value = on ? [...selected.value, key] : selected.value.filter((k) => k !== key)
    persist()
  }

  function reset() {
    selected.value = [...DEFAULT_KEYS]
    persist()
  }

  return { selected, visible, isOn, toggle, reset }
}
