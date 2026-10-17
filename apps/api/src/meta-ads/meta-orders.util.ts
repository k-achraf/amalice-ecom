import type { MetaOrderStats } from '@amalice/shared'

// Pure helpers of the Meta Ads profitability report: classify an order by its state, tie an order to
// a campaign / ad set / ad, and turn the sums into rates and profit. See the definitions in
// packages/shared/src/meta-ads.ts.

const PENDING = new Set(['PendingCallCenter', 'CallCenterNoAnswer', 'Postponed'])
const CALL_CENTER_FAILED = new Set(['Cancelled', 'WrongNumber'])
const DELIVERED = new Set(['Delivered', 'CashCollected', 'Reconciled', 'Settled'])
const RETURNED = new Set(['ReturnedToOrigin', 'Restocked'])

export type OrderBucket = 'pending' | 'cancelledByCallCenter' | 'inProgress' | 'delivered' | 'returned' | 'cancelledAfterConfirm'

export function bucketOf(state: string): OrderBucket {
  if (PENDING.has(state)) return 'pending'
  if (CALL_CENTER_FAILED.has(state)) return 'cancelledByCallCenter'
  if (DELIVERED.has(state)) return 'delivered'
  if (RETURNED.has(state)) return 'returned'
  if (state === 'CancelledShipping') return 'cancelledAfterConfirm'
  // Confirmed, OnHold, Packed, HandedToCourier, OutForDelivery, DeliveryFailed.
  return 'inProgress'
}

// ---- accumulation ----

export interface OrderAcc {
  orders: number
  pending: number
  cancelledByCallCenter: number
  inProgress: number
  delivered: number
  returned: number
  cancelledAfterConfirm: number
  revenueCents: number
  inProgressValueCents: number
  returnedValueCents: number
  productCostCents: number
  courierFeeCents: number
}

export const emptyAcc = (): OrderAcc => ({
  orders: 0, pending: 0, cancelledByCallCenter: 0, inProgress: 0, delivered: 0, returned: 0, cancelledAfterConfirm: 0,
  revenueCents: 0, inProgressValueCents: 0, returnedValueCents: 0, productCostCents: 0, courierFeeCents: 0
})

export interface OrderFacts {
  state: string
  totalCents: number
  // Sum of unit cost x quantity of its lines (0 when costs are unknown).
  productCostCents: number
  carrierFeeCents: number | null
  returnFeeCents: number | null
}

export function addOrder(acc: OrderAcc, o: OrderFacts): void {
  acc.orders += 1
  const bucket = bucketOf(o.state)
  acc[bucket] += 1
  if (bucket === 'delivered') {
    acc.revenueCents += o.totalCents
    acc.productCostCents += o.productCostCents
    acc.courierFeeCents += o.carrierFeeCents ?? 0
  } else if (bucket === 'returned') {
    // The goods come back to stock; the courier still charges its return fee.
    acc.returnedValueCents += o.totalCents
    acc.courierFeeCents += o.returnFeeCents ?? 0
  } else if (bucket === 'inProgress') {
    acc.inProgressValueCents += o.totalCents
  }
}

export function sumAccs(list: OrderAcc[]): OrderAcc {
  const out = emptyAcc()
  for (const a of list) for (const k of Object.keys(out) as (keyof OrderAcc)[]) out[k] += a[k]
  return out
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null)
const per = (a: number, b: number) => (b > 0 ? a / b : null)

// `adSpendDzd` null = the ad account has no exchange rate yet: profit stays unknown.
export function finalize(acc: OrderAcc, adSpendDzd: number | null): MetaOrderStats {
  const confirmed = acc.inProgress + acc.delivered + acc.returned + acc.cancelledAfterConfirm
  const revenue = acc.revenueCents / 100
  const productCost = acc.productCostCents / 100
  const courierFees = acc.courierFeeCents / 100
  const grossProfit = revenue - productCost - courierFees
  const profit = adSpendDzd === null ? null : grossProfit - adSpendDzd
  return {
    orders: acc.orders,
    pending: acc.pending,
    cancelledByCallCenter: acc.cancelledByCallCenter,
    confirmed,
    inProgress: acc.inProgress,
    delivered: acc.delivered,
    returned: acc.returned,
    cancelledAfterConfirm: acc.cancelledAfterConfirm,
    confirmationRate: pct(confirmed, acc.orders),
    deliveryRate: pct(acc.delivered, confirmed),
    returnRate: pct(acc.returned, confirmed),
    finalDeliveryRate: pct(acc.delivered, acc.delivered + acc.returned),
    revenue,
    inProgressValue: acc.inProgressValueCents / 100,
    returnedValue: acc.returnedValueCents / 100,
    productCost,
    courierFees,
    grossProfit,
    adSpend: adSpendDzd,
    profit,
    roi: adSpendDzd && profit !== null ? (profit / adSpendDzd) * 100 : null,
    realRoas: adSpendDzd ? per(revenue, adSpendDzd) : null,
    costPerOrder: adSpendDzd === null ? null : per(adSpendDzd, acc.orders),
    costPerDelivered: adSpendDzd === null ? null : per(adSpendDzd, acc.delivered)
  }
}

// ---- tying orders to ads ----

export interface AttributionHints {
  campaignId: string | null
  adsetId: string | null
  adId: string | null
  campaignName: string | null
  adsetName: string | null
  adName: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}

export interface EntityIndex {
  campaigns: Map<string, { name: string; status: string }>
  adsets: Map<string, { name: string; status: string; campaignId: string | null }>
  ads: Map<string, { name: string; status: string; adsetId: string | null; campaignId: string | null }>
}

export interface Chain { campaignId: string | null; adsetId: string | null; adId: string | null }

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

// name -> id, only for names that identify exactly one entity (a duplicated name could be either).
function uniqueNames<T extends { name: string }>(map: Map<string, T>): Map<string, string> {
  const seen = new Map<string, string | null>()
  for (const [id, e] of map) {
    const key = norm(e.name)
    if (!key) continue
    seen.set(key, seen.has(key) ? null : id)
  }
  const out = new Map<string, string>()
  for (const [k, v] of seen) if (v) out.set(k, v)
  return out
}

export function buildMatcher(index: EntityIndex) {
  const campaignNames = uniqueNames(index.campaigns)
  const adsetNames = uniqueNames(index.adsets)
  const adNames = uniqueNames(index.ads)

  // Ids from the ad URL win; names (utm_campaign / utm_term / utm_content, or the explicit *_name params) fill the gaps.
  return function resolve(a: AttributionHints): Chain {
    let adId = a.adId && index.ads.has(a.adId) ? a.adId : null
    adId ??= adNames.get(norm(a.adName ?? a.utmContent)) ?? null

    let adsetId = a.adsetId && index.adsets.has(a.adsetId) ? a.adsetId : null
    adsetId ??= (adId ? index.ads.get(adId)?.adsetId : null) ?? null
    adsetId ??= adsetNames.get(norm(a.adsetName ?? a.utmTerm)) ?? null

    let campaignId = a.campaignId && index.campaigns.has(a.campaignId) ? a.campaignId : null
    campaignId ??= (adsetId ? index.adsets.get(adsetId)?.campaignId : null) ?? null
    campaignId ??= (adId ? index.ads.get(adId)?.campaignId : null) ?? null
    campaignId ??= campaignNames.get(norm(a.campaignName ?? a.utmCampaign)) ?? null

    return { campaignId, adsetId, adId }
  }
}
