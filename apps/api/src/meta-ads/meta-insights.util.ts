import type { MetaInsightsMetrics } from '@amalice/shared'

interface RawAction { action_type: string; value: string }
export interface RawInsights {
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  ctr?: string
  cpc?: string
  cpm?: string
  actions?: RawAction[]
  action_values?: RawAction[]
  purchase_roas?: RawAction[]
}

// Currencies whose Graph "minor unit" is the major unit itself.
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'PYG', 'UGX', 'XAF', 'XOF', 'ISK'])

// Budgets, balance and amount_spent come in minor units (e.g. cents).
export function fromMinorUnits(value: string | undefined | null, currency: string | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return ZERO_DECIMAL.has(currency ?? '') ? n : n / 100
}

const num = (v: string | undefined) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v))
const numOrNull = (v: string | undefined) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// Meta reports each result under several action types; take the first present in priority order.
function pick(list: RawAction[] | undefined, types: string[]): number {
  for (const type of types) {
    const hit = list?.find((a) => a.action_type === type)
    if (hit) return num(hit.value)
  }
  return 0
}

const PURCHASE_TYPES = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase']
const LEAD_TYPES = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']

export function toMetrics(raw: RawInsights | undefined | null): MetaInsightsMetrics | null {
  if (!raw) return null
  const spend = num(raw.spend)
  const purchases = pick(raw.actions, PURCHASE_TYPES)
  const purchaseValue = pick(raw.action_values, PURCHASE_TYPES)
  const roas = pick(raw.purchase_roas, PURCHASE_TYPES)
  return {
    spend,
    impressions: num(raw.impressions),
    reach: num(raw.reach),
    clicks: num(raw.clicks),
    ctr: num(raw.ctr),
    cpc: numOrNull(raw.cpc),
    cpm: numOrNull(raw.cpm),
    purchases,
    leads: pick(raw.actions, LEAD_TYPES),
    costPerPurchase: purchases > 0 ? spend / purchases : null,
    purchaseValue,
    roas: roas > 0 ? roas : spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null
  }
}

export const INSIGHT_FIELDS = 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas'
