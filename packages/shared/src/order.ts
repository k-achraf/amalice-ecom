import { z } from 'zod'
import { AddressSchema } from './customer'

// Every state from the order lifecycle state machine (cod-platform-plan.md
// §7) — the single source of truth other places (StatusBadge, the DB enum
// in FND-06) must stay in sync with.
export const OrderState = z.enum([
  'PendingOTP',
  'Cancelled',
  'Confirmed',
  'Packed',
  'HandedToCourier',
  'OutForDelivery',
  'DeliveryFailed',
  'Delivered',
  'ReturnedToOrigin',
  'Restocked',
  'CashCollected',
  'Reconciled',
  'Settled'
])
export type OrderState = z.infer<typeof OrderState>

export const OrderItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
  // Cents, not floats — avoids float rounding bugs in money math (same
  // convention as PriceDisplay in packages/ui).
  unitPriceCents: z.number().int().nonnegative()
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const CreateOrderSchema = z.object({
  customerId: z.uuid(),
  addressId: z.uuid(),
  items: z.array(OrderItemSchema).min(1)
})
export type CreateOrder = z.infer<typeof CreateOrderSchema>

export const OrderSchema = CreateOrderSchema.extend({
  id: z.uuid(),
  state: OrderState.default('PendingOTP'),
  courierId: z.uuid().nullable().default(null),
  totalCents: z.number().int().nonnegative()
})
export type Order = z.infer<typeof OrderSchema>

// The real customer-facing checkout request — deliberately NOT the same
// shape as CreateOrderSchema above. No unitPriceCents from the client: the
// server looks up live Product prices and stock (SF-04's "never trust the
// client cart total"). No customerId/addressId either — first-time
// checkout customers don't have either yet; the server upserts a Customer
// by phone and creates the Address as part of placing the order.
export const CheckoutItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive()
})
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>

export const CheckoutSchema = z.object({
  phone: z.e164(),
  name: z.string().min(1).max(200).optional(),
  address: AddressSchema.omit({ id: true }),
  items: z.array(CheckoutItemSchema).min(1)
})
export type Checkout = z.infer<typeof CheckoutSchema>

// Lead form order — dynamic fields. The storefront sends whatever fields the
// admin configured; the API maps known core keys (name, phone, wilaya, commune)
// to customer/address columns. Extra fields are stored in address.line2 as JSON.
export const LeadOrderSchema = z.object({
  fields: z.record(z.string()),
  items: z.array(CheckoutItemSchema).min(1)
})
export type LeadOrder = z.infer<typeof LeadOrderSchema>

export const ConfirmOrderSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'must be a 6-digit code')
})
export type ConfirmOrder = z.infer<typeof ConfirmOrderSchema>

// Order ID is in the URL; phone is the shared secret that makes this a
// legitimate public lookup instead of "guess a UUID, read anyone's order."
export const TrackOrderQuerySchema = z.object({
  phone: z.e164()
})
export type TrackOrderQuery = z.infer<typeof TrackOrderQuerySchema>

export interface OrderTrackingInfo {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  trackingReference: string | null
}

export interface OrderHistoryItem {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  items: { productId: string; quantity: number; unitPriceCents: number }[]
}

// ADM-04 — the admin order queue response shape. The customer summary is
// joined for the table; PII scoping (phone masking) happens server-side per
// the requesting role (plan §11).
export interface AdminOrderListItem {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  customer: { id: string; name: string | null; phone: string }
  items: { productId: string; quantity: number; unitPriceCents: number; product: { name: string; slug: string } }[]
  shipment?: { courier: { name: string } } | null
}

export interface OrderListResponse {
  items: AdminOrderListItem[]
  total: number
  page: number
  pageSize: number
}
