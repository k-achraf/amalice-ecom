import type { FunnelStats } from './funnel-stats'
import type { FunnelStepType } from './funnel'

// ---- Next test for a funnel ---------------------------------------------------
// Rule-based, from the funnel's own stats (see funnel-stats.ts): each rule
// looks at one stage of the visit → order path and, when that stage is the
// weak one AND there is enough traffic to trust the number, proposes ONE
// change to A/B test. Pure, so the API, tests and any preview agree. No AI
// involved: every figure quoted comes straight from the stats.

export type FunnelTestArea = 'traffic' | 'hook' | 'engagement' | 'offer' | 'form' | 'upsell' | 'quality' | 'device'

export interface FunnelTestSuggestion {
  id: string
  area: FunnelTestArea
  title: string
  // Why this was picked, with the numbers it is based on.
  evidence: string
  // What to change in the variant.
  change: string
  // The figure that decides the test.
  metric: string
  // Rough visitors per variant before the result means anything.
  minVisitorsPerVariant: number
  // Higher = look at it first.
  priority: number
}

export interface FunnelSuggestionResult {
  days: number
  // 'collect-data' = not enough traffic for any test yet.
  status: 'collect-data' | 'ready' | 'healthy'
  summary: string
  suggestions: FunnelTestSuggestion[]
}

export const FUNNEL_MIN_VISITORS = 100
const MIN_TRACKED = 30
const MIN_ORDERS_FOR_QUALITY = 15

const p = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`)

export function suggestFunnelTests(stats: FunnelStats, stepTypes: { type: FunnelStepType; enabled: boolean }[]): FunnelSuggestionResult {
  const { traffic: t, sales: s, fulfilment: f } = stats
  const out: FunnelTestSuggestion[] = []
  const add = (x: FunnelTestSuggestion) => out.push(x)
  const highBounce = t.trackedVisits >= MIN_TRACKED && t.bounceRate != null && t.bounceRate >= 60

  if (t.uniqueVisitors < FUNNEL_MIN_VISITORS) {
    return {
      days: stats.days,
      status: 'collect-data',
      summary: `Only ${t.uniqueVisitors} visitors in ${stats.days} days. Wait for about ${FUNNEL_MIN_VISITORS} before testing: below that, differences are mostly chance.`,
      suggestions: [
        {
          id: 'collect-data',
          area: 'traffic',
          title: 'Send more traffic before testing',
          evidence: `${t.uniqueVisitors} unique visitors and ${s.orders} orders in the last ${stats.days} days.`,
          change: 'Keep the funnel as it is and let the current ads run; no change yet.',
          metric: 'Unique visitors',
          minVisitorsPerVariant: FUNNEL_MIN_VISITORS,
          priority: 100
        }
      ]
    }
  }

  if (highBounce) {
    add({
      id: 'hook', area: 'hook', priority: 90,
      title: 'Test a new opening (headline and first image)',
      evidence: `${p(t.bounceRate)} of ${t.trackedVisits} tracked visits leave within 10 seconds without scrolling or touching the form.`,
      change: 'Keep everything else identical and change only the first screen: the headline, or the main product photo.',
      metric: 'Bounce rate, then conversion rate', minVisitorsPerVariant: 150
    })
  }
  if (t.trackedVisits >= MIN_TRACKED && t.avgScrollDepth != null && t.avgScrollDepth < 40 && !highBounce) {
    add({
      id: 'page-length', area: 'engagement', priority: 70,
      title: 'Test a shorter page, or the order form higher up',
      evidence: `Visitors scroll only ${p(t.avgScrollDepth)} of the page on average.`,
      change: 'Variant B: fewer sections, or an order button right after the first benefit, so the form is seen before they stop scrolling.',
      metric: 'Form-start rate', minVisitorsPerVariant: 150
    })
  }
  if (t.views >= FUNNEL_MIN_VISITORS && t.formStartRate != null && t.formStartRate < 15 && !highBounce) {
    add({
      id: 'cta-offer', area: 'offer', priority: 80,
      title: 'Test the offer or the call to action',
      evidence: `Only ${p(t.formStartRate)} of ${t.views} views start the order form, though visitors do stay on the page.`,
      change: 'Variant B: a clearer button label and position, or a different quantity offer (bundle price) if the product has one.',
      metric: 'Form-start rate', minVisitorsPerVariant: 200
    })
  }
  if (s.formDropOffRate != null && t.formVisitors >= 30 && s.formDropOffRate >= 50) {
    add({
      id: 'form', area: 'form', priority: 85,
      title: 'Test a shorter order form',
      evidence: `${p(s.formDropOffRate)} of the visitors who start the form never order (${t.formVisitors} visitors started the form, ${s.orders} orders).`,
      change: 'Variant B: only name, phone, wilaya and commune; move optional fields out or after the order.',
      metric: 'Orders ÷ form starts', minVisitorsPerVariant: 100
    })
  }
  const hasUpsell = stepTypes.some((x) => x.enabled && (x.type === 'OrderBump' || x.type === 'Upsell' || x.type === 'Downsell'))
  if (s.orders >= 20) {
    if (!hasUpsell) {
      add({
        id: 'add-offer', area: 'upsell', priority: 60,
        title: 'Add an order bump',
        evidence: `${s.orders} orders and no enabled bump / upsell / downsell step.`,
        change: 'Variant B: a tick-box add-on in the order form (a complementary product from your catalogue).',
        metric: 'Average order value', minVisitorsPerVariant: 200
      })
    } else if (s.upsellRate != null && s.upsellRate < 10) {
      add({
        id: 'upsell-offer', area: 'upsell', priority: 55,
        title: 'Test a different add-on offer',
        evidence: `Only ${p(s.upsellRate)} of ${s.orders} orders take an add-on.`,
        change: 'Variant B: another product or a different price for the existing add-on step.',
        metric: 'Add-on take rate', minVisitorsPerVariant: 200
      })
    }
  }
  if (s.orders >= MIN_ORDERS_FOR_QUALITY && f.confirmationRate != null && f.confirmationRate < 50) {
    add({
      id: 'lead-quality', area: 'quality', priority: 75,
      title: 'Check traffic quality before changing the page',
      evidence: `Only ${p(f.confirmationRate)} of ${s.orders} orders are confirmed by the call center.`,
      change: 'Compare confirmation rate by source / campaign and pause the weakest; consider a stricter audience.',
      metric: 'Confirmation rate', minVisitorsPerVariant: 100
    })
  }
  if (f.returned + f.delivered >= 15 && f.finalDeliveryRate != null && f.finalDeliveryRate < 70) {
    add({
      id: 'returns', area: 'quality', priority: 72,
      title: 'Reduce returns: set expectations on the page',
      evidence: `${p(f.finalDeliveryRate)} of finished orders are delivered; ${f.returned} came back.`,
      change: 'Variant B: state the total price and the confirmation call clearly next to the order button.',
      metric: 'Final delivery rate', minVisitorsPerVariant: 200
    })
  }
  const mobile = stats.devices.find((d) => /mobile/i.test(d.key))
  const desktop = stats.devices.find((d) => /desktop/i.test(d.key))
  if (mobile && desktop && mobile.visitors >= 50 && desktop.visitors >= 50 && mobile.conversionRate != null && desktop.conversionRate != null && desktop.conversionRate > 0 && mobile.conversionRate < desktop.conversionRate / 2) {
    add({
      id: 'mobile', area: 'device', priority: 65,
      title: 'Check the mobile layout',
      evidence: `Mobile converts ${p(mobile.conversionRate)} against ${p(desktop.conversionRate)} on desktop (${mobile.visitors} / ${desktop.visitors} visitors).`,
      change: 'Open the funnel on a phone and fix the first screen and the order form; then compare again.',
      metric: 'Mobile conversion rate', minVisitorsPerVariant: 150
    })
  }
  const dead = stats.sources.find((r) => r.visitors >= 60 && r.orders === 0)
  if (dead) {
    add({
      id: 'dead-source', area: 'traffic', priority: 68,
      title: `Review the "${dead.key}" traffic`,
      evidence: `${dead.visitors} visitors from "${dead.key}" and no order.`,
      change: 'Pause or re-target that source and compare conversion again after a few days.',
      metric: 'Conversion rate by source', minVisitorsPerVariant: 100
    })
  }

  out.sort((a, b) => b.priority - a.priority)
  if (out.length === 0) {
    return {
      days: stats.days,
      status: 'healthy',
      summary: `No weak stage found: conversion is ${p(s.conversionRate)} on ${t.uniqueVisitors} visitors. To keep improving, test the price or the quantity offer next.`,
      suggestions: [
        {
          id: 'price-offer', area: 'offer', priority: 10,
          title: 'Test the price or the quantity offer',
          evidence: `Nothing stands out in the funnel stages (conversion ${p(s.conversionRate)}).`,
          change: 'Variant B: a different bundle price or quantity offer. Change one thing only.',
          metric: 'Conversion rate and profit per visitor', minVisitorsPerVariant: 300
        }
      ]
    }
  }
  return { days: stats.days, status: 'ready', summary: `Start with: ${out[0]!.title}.`, suggestions: out.slice(0, 4) }
}
