import type { MetaOrderStats } from './meta-ads'

// Admin funnel detail → "Stats" tab: traffic, engagement and sales of one
// funnel over a lookback window. Traffic comes from the first-party
// PageViewEvent rows the funnel page writes; orders from Order.funnelId.
export interface FunnelStatsTraffic {
  views: number
  uniqueVisitors: number
  // Visits that reported engagement (the base of the three figures below).
  trackedVisits: number
  avgDurationSeconds: number | null
  avgScrollDepth: number | null
  // Share of tracked visits that left quickly without scrolling or touching the form.
  bounceRate: number | null
  formStarts: number
  // formStarts / views, in percent.
  formStartRate: number | null
}

export interface FunnelStatsSales {
  // Orders placed on the funnel (abandoned carts excluded).
  orders: number
  // Orders ÷ unique visitors, in percent.
  conversionRate: number | null
  // Orders ÷ views, in percent.
  conversionPerView: number | null
  // Value of every order placed (cash due), cancelled included.
  grossValue: number
  avgOrderValue: number | null
  // Orders with at least one upsell / downsell / bump line.
  ordersWithUpsell: number
  upsellRate: number | null
  upsellRevenue: number
  // Visitors who started the form but did not order, in percent of starters.
  formDropOffRate: number | null
}

export interface FunnelStatsDay {
  date: string
  views: number
  visitors: number
  orders: number
}

export interface FunnelStatsBreakdownRow {
  key: string
  visitors: number
  orders: number
  conversionRate: number | null
}

export interface FunnelStats {
  days: number
  traffic: FunnelStatsTraffic
  sales: FunnelStatsSales
  // Confirmation / delivery / return rates and money (no ad spend).
  fulfilment: MetaOrderStats
  daily: FunnelStatsDay[]
  devices: FunnelStatsBreakdownRow[]
  sources: FunnelStatsBreakdownRow[]
  campaigns: FunnelStatsBreakdownRow[]
  wilayas: { key: string; orders: number }[]
}
