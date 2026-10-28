import { z } from 'zod'

// One filter vocabulary for every order-based admin page (orders, call center,
// fulfillment, shipping, delivery details). The API reads these as query-string
// params on GET admin/orders and GET admin/deliveries; the admin's <OrderFilters>
// bar builds them. All fields optional; an absent field means "no restriction".
// Combine freely: they are ANDed (product + funnel + company + wilaya + …).
export const ORDER_FILTER_KEYS = [
  'productId', 'variantId', 'offerId', 'funnelId', 'companyId', 'region', 'city', 'shippingType',
  'platform', 'riskLevel', 'minTotal', 'maxTotal', 'from', 'to', 'hasTracking', 'confirmedByCourier', 'courierStatus'
] as const
export type OrderFilterKey = (typeof ORDER_FILTER_KEYS)[number]

export const OrderFiltersSchema = z.object({
  // Orders that contain this product (any line item).
  productId: z.string().optional(),
  // ...in this specific variant of it.
  variantId: z.string().optional(),
  // Orders that contain a line sold through this product offer (the offers the funnels show).
  offerId: z.string().optional(),
  // Orders placed through this funnel. Use the sentinel 'none' for orders not from any funnel (plain storefront).
  funnelId: z.string().optional(),
  // Shipping company the order is assigned to.
  companyId: z.string().optional(),
  // Delivery wilaya (Address.region) and commune (Address.city), matched by exact name.
  region: z.string().optional(),
  city: z.string().optional(),
  shippingType: z.enum(['Home', 'Desk']).optional(),
  // Ad source (OrderAttribution.platform).
  platform: z.enum(['Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct']).optional(),
  riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
  // Order total in DA (whole dinars, NOT cents).
  minTotal: z.coerce.number().nonnegative().optional(),
  maxTotal: z.coerce.number().nonnegative().optional(),
  // Created between (ISO dates).
  from: z.string().optional(),
  to: z.string().optional(),
  // Shipment has / has not a tracking number: 'yes' | 'no'.
  hasTracking: z.enum(['yes', 'no']).optional(),
  // Courier has taken the parcel (Shipment.carrierConfirmedAt set): 'yes' | 'no'.
  confirmedByCourier: z.enum(['yes', 'no']).optional(),
  // The courier's own status code (Shipment.courierStatus), exact.
  courierStatus: z.string().optional()
})
export type OrderFilters = z.infer<typeof OrderFiltersSchema>

export const FUNNEL_NONE = 'none'

// Options to fill the filter bar's selects, from GET admin/orders/filter-options
// (open to every role that can see an order page).
export interface OrderFilterOptions {
  products: { id: string; name: string }[]
  funnels: { id: string; name: string }[]
  companies: { id: string; name: string }[]
  regions: string[]
  // Every offer of every product (enabled or not: old orders keep theirs), to pick one after the product.
  offers: { id: string; productId: string; label: string; enabled: boolean }[]
}

// Drop empty values so the URL / request stays clean.
export function cleanOrderFilters(f: Partial<Record<OrderFilterKey, unknown>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of ORDER_FILTER_KEYS) {
    const v = f[k]
    if (v !== undefined && v !== null && v !== '' && v !== 'all') out[k] = String(v)
  }
  return out
}
