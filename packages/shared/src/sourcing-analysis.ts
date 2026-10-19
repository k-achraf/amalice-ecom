import { z } from 'zod'
import type { RiskLevel } from './risk'

// ---- Sourcing research analysis -----------------------------------------------
// Two things for a product still being researched: (1) a summary of the
// competitor listings the team recorded (prices + notes; the AI summarises,
// code does the arithmetic), and (2) how risky the product's category has been
// for returns in our own past orders.

export const COMPETITOR_SUMMARY_LIMIT = 12

export interface CompetitorPriceStats {
  count: number
  withPrice: number
  minCents: number | null
  maxCents: number | null
  medianCents: number | null
}

export function competitorPriceStats(competitors: { priceCents: number | null }[]): CompetitorPriceStats {
  const prices = competitors.map((c) => c.priceCents).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b)
  const mid = Math.floor(prices.length / 2)
  return {
    count: competitors.length,
    withPrice: prices.length,
    minCents: prices[0] ?? null,
    maxCents: prices[prices.length - 1] ?? null,
    medianCents: prices.length === 0 ? null : prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
  }
}

export const CompetitorSummaryModelSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  pricePosition: z.string().trim().min(1).max(250),
  points: z.array(z.string().trim().min(1).max(200)).max(5)
})
export type CompetitorSummaryModel = z.infer<typeof CompetitorSummaryModelSchema>

// ---- category return risk ----

export const CATEGORY_MIN_SAMPLE = 10
export const CATEGORY_STATS_DAYS = 180

export type CategoryRiskLevel = RiskLevel | 'Unknown'

export interface CategoryReturnRow {
  category: string
  finished: number
  returned: number
  ratePct: number | null
  level: CategoryRiskLevel
}

// Finished = delivered or returned. Below CATEGORY_MIN_SAMPLE the rate is shown but the
// level stays Unknown: a handful of orders says nothing about a category.
export function categoryRiskLevel(finished: number, returned: number, storeRatePct: number | null): CategoryRiskLevel {
  if (finished < CATEGORY_MIN_SAMPLE) return 'Unknown'
  const rate = (returned / finished) * 100
  const base = storeRatePct ?? 20
  if (rate >= Math.max(35, base * 1.5)) return 'High'
  if (rate >= Math.max(20, base * 1.15)) return 'Medium'
  return 'Low'
}

export function buildCategoryRows(counts: Map<string, { finished: number; returned: number }>, storeRatePct: number | null): CategoryReturnRow[] {
  return [...counts]
    .map(([category, c]) => ({
      category,
      finished: c.finished,
      returned: c.returned,
      ratePct: c.finished > 0 ? (c.returned / c.finished) * 100 : null,
      level: categoryRiskLevel(c.finished, c.returned, storeRatePct)
    }))
    .sort((a, b) => (b.ratePct ?? -1) - (a.ratePct ?? -1))
}

const foldName = (v: string) => v.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Picks the recorded category that the sourced product's free-text niche refers to
// ("kitchen gadgets" → "Kitchen"): exact match first, then one containing the other.
export function matchCategory(niche: string | null | undefined, categories: string[]): string | null {
  const n = foldName(niche ?? '')
  if (!n) return null
  const folded = categories.map((c) => [c, foldName(c)] as const).filter(([, f]) => f)
  return (
    folded.find(([, f]) => f === n)?.[0] ??
    folded.find(([, f]) => f.length >= 3 && (n.includes(f) || f.includes(n)))?.[0] ??
    null
  )
}

export interface SourcingAnalysis {
  sourcedProductId: string
  competitors: {
    stats: CompetitorPriceStats
    // Prices we tested (ad tests), in cents, for comparison.
    ourTestPricesCents: number[]
    // AI reading of the recorded listings; null when there is nothing to read or the AI is unavailable.
    summary: CompetitorSummaryModel | null
    aiUnavailableReason: string | null
  }
  returnRisk: {
    niche: string | null
    matchedCategory: string | null
    category: CategoryReturnRow | null
    storeRatePct: number | null
    storeFinished: number
    windowDays: number
    // Worst categories in the store, for context.
    worst: CategoryReturnRow[]
    note: string
  }
}
