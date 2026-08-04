import { z } from 'zod'
import { AddressSchema } from './customer'
import { CheckoutTrackingSchema } from './apps'
import { ShippingTypeSchema, type ShippingType } from './shipping'
import { PhoneSchema } from './phone'
import type { FulfillmentMethod } from './shipment'

// Every state from the order lifecycle state machine (cod-platform-plan.md
// §7) — the single source of truth other places (StatusBadge, the DB enum
// in FND-06) must stay in sync with.
//
// The 3-stage pipeline: an order is placed and lands directly with a human
// call-center agent, who confirms it's real before anything is picked
// (PendingCallCenter / CallCenterNoAnswer / WrongNumber / Postponed) →
// warehouse fulfillment packs it (Confirmed / OnHold / Packed) → shipping
// hands it to a courier through delivery (HandedToCourier onward). Cash/
// ledger reconciliation (CashCollected onward) is a later, separate stage
// owned by the existing Reconciliation feature, not part of this one.
// (No OTP gate before call-center — removed: the call-center confirmation
// call already verifies the order is real.)
//
// WrongNumber/Postponed/OnHold were added after real-world use surfaced
// three call-center/fulfillment outcomes that CallCenterNoAnswer/Confirmed
// couldn't represent: a genuinely bad phone number (distinct from "didn't
// pick up" — no amount of retrying fixes it), a customer who wants contact
// deferred to a later date (distinct from "no answer", so it doesn't get
// retried immediately), and a confirmed order that can't be packed as-is
// (stock ran out between confirm and pack) without cancelling it outright.
export const OrderState = z.enum([
  'PendingCallCenter',
  'CallCenterNoAnswer',
  'WrongNumber',
  'Postponed',
  'Cancelled',
  'Confirmed',
  'OnHold',
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

// The order lifecycle state machine — the single source of truth for which
// transitions are legal. Consulted by BOTH the API (server-side enforcement,
// the actual guard) and the admin UI (so an illegal transition can't even be
// submitted — client-side gating is UX only). Previously hand-duplicated
// between apps/api/src/common/order-transitions.ts and apps/admin's own
// composable, "kept in sync by hand" per their comments — that drift risk is
// exactly what a shared package exists to remove.
export const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  PendingCallCenter: ['Confirmed', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Cancelled'],
  CallCenterNoAnswer: ['PendingCallCenter', 'Cancelled'],
  WrongNumber: ['PendingCallCenter', 'Cancelled'],
  Postponed: ['PendingCallCenter', 'Cancelled'],
  Cancelled: [],
  Confirmed: ['Packed', 'OnHold', 'Cancelled'],
  OnHold: ['Confirmed', 'Packed', 'Cancelled'],
  Packed: ['HandedToCourier'],
  HandedToCourier: ['OutForDelivery'],
  OutForDelivery: ['Delivered', 'DeliveryFailed'],
  DeliveryFailed: ['OutForDelivery', 'ReturnedToOrigin'],
  Delivered: ['CashCollected'],
  ReturnedToOrigin: ['Restocked'],
  Restocked: [],
  CashCollected: ['Reconciled'],
  Reconciled: ['Settled'],
  Settled: []
}

export function isValidTransition(from: OrderState, to: OrderState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// Which of the 3 operational stages (plus a residual "Other"/"Finance"
// bucket) each state belongs to — drives which admin page a given order
// shows up on. A single source of truth so the Call Center, Fulfillment,
// and Shipping pages can derive "which states are mine" from here instead
// of each hardcoding its own state list.
export const ORDER_STAGES = ['CallCenter', 'Fulfillment', 'Shipping', 'Finance', 'Other'] as const
export type OrderStage = (typeof ORDER_STAGES)[number]

export const ORDER_STAGE_BY_STATE: Record<OrderState, OrderStage> = {
  PendingCallCenter: 'CallCenter',
  CallCenterNoAnswer: 'CallCenter',
  WrongNumber: 'CallCenter',
  Postponed: 'CallCenter',
  Cancelled: 'Other',
  // Confirmed is where call-center's job ends (they confirmed the order is
  // real) — grouped with the CallCenter stage rather than Fulfillment so it
  // shows up in the Call Center section/status column, not Fulfillment's.
  Confirmed: 'CallCenter',
  OnHold: 'Fulfillment',
  Packed: 'Fulfillment',
  HandedToCourier: 'Shipping',
  OutForDelivery: 'Shipping',
  DeliveryFailed: 'Shipping',
  Delivered: 'Shipping',
  ReturnedToOrigin: 'Shipping',
  Restocked: 'Other',
  CashCollected: 'Finance',
  Reconciled: 'Finance',
  Settled: 'Finance'
}

export function statesForStage(stage: OrderStage): OrderState[] {
  return OrderState.options.filter((s) => ORDER_STAGE_BY_STATE[s] === stage)
}

// Human-readable label per state — the single source of truth StatusBadge
// (packages/ui) reads its display text from, and also what the Google
// Sheets integration writes into a row's Status column server-side (see
// apps/api/src/google-sheets/google-sheets.service.ts) so the sheet reads
// the same words an admin sees in the dashboard rather than a raw enum key.
export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  PendingCallCenter: 'Awaiting confirmation call',
  CallCenterNoAnswer: 'No answer — retry needed',
  WrongNumber: 'Wrong number',
  Postponed: 'Postponed',
  Cancelled: 'Cancelled',
  Confirmed: 'Confirmed',
  OnHold: 'On hold',
  Packed: 'Packed',
  HandedToCourier: 'With courier',
  OutForDelivery: 'Out for delivery',
  DeliveryFailed: 'Delivery attempt failed',
  Delivered: 'Delivered',
  ReturnedToOrigin: 'Returned to origin',
  Restocked: 'Restocked',
  CashCollected: 'Cash collected',
  Reconciled: 'Reconciled',
  Settled: 'Settled'
}

// Per-state cell color for the Google Sheets integration's 3 status columns
// (Call Center/Fulfillment/Delivery — see GoogleSheetsService) — deliberately
// mirrors StatusBadge's STATE_MAP hue assignment in packages/ui (17 states,
// 17 distinct Tailwind hues, zero repeats — every state visually
// distinguishable from every other) so a sheet's status color always matches
// what the admin dashboard shows for the same state. Plain hex here (not
// Tailwind classes) since apps/api has no dependency on packages/ui and the
// Sheets API's cell-format requests need RGB, not CSS. Background is each
// hue's Tailwind 100 shade, text its 800 shade — same pairing Tailwind's own
// "soft" badge convention uses, for readable contrast without saturation.
// Deliberate anchors: Confirmed is green, Delivered is a DIFFERENT green
// (emerald) — both read as "success" but are still visually distinct from
// each other; Cancelled and ReturnedToOrigin both sit in the red family
// (red / rose) since both are negative outcomes, again using different exact
// hues so neither collides with the other or with any other state.
export const ORDER_STATE_SHEET_COLORS: Record<OrderState, { background: string; text: string }> = {
  PendingCallCenter: { background: '#FEF3C7', text: '#92400E' }, // amber
  CallCenterNoAnswer: { background: '#FFEDD5', text: '#9A3412' }, // orange
  WrongNumber: { background: '#FAE8FF', text: '#86198F' }, // fuchsia
  Postponed: { background: '#FEF9C3', text: '#854D0E' }, // yellow
  Cancelled: { background: '#FEE2E2', text: '#991B1B' }, // red
  Confirmed: { background: '#DCFCE7', text: '#166534' }, // green
  OnHold: { background: '#EDE9FE', text: '#5B21B6' }, // violet
  Packed: { background: '#DBEAFE', text: '#1E40AF' }, // blue
  HandedToCourier: { background: '#E0E7FF', text: '#3730A3' }, // indigo
  OutForDelivery: { background: '#E0F2FE', text: '#075985' }, // sky
  DeliveryFailed: { background: '#FCE7F3', text: '#9D174D' }, // pink
  Delivered: { background: '#D1FAE5', text: '#065F46' }, // emerald
  ReturnedToOrigin: { background: '#FFE4E6', text: '#9F1239' }, // rose
  Restocked: { background: '#F1F5F9', text: '#1E293B' }, // slate
  CashCollected: { background: '#ECFCCB', text: '#3F6212' }, // lime
  Reconciled: { background: '#CCFBF1', text: '#115E59' }, // teal
  Settled: { background: '#CFFAFE', text: '#155E75' } // cyan
}

export const OrderItemSchema = z.object({
  productId: z.uuid(),
  // Which ProductVariant (if any) was ordered — null for a product with no
  // variants, or a variant-less purchase of a product that has some (rare,
  // but not disallowed). Kept even if the variant is later deleted, purely
  // for order-history traceability (same reasoning as offerId below).
  variantId: z.uuid().nullable().optional(),
  quantity: z.number().int().positive(),
  // Cents, not floats — avoids float rounding bugs in money math (same
  // convention as PriceDisplay in packages/ui). Reference/undiscounted
  // per-unit price — NOT what was charged when an offer applied; see
  // lineTotalCents for that.
  unitPriceCents: z.number().int().nonnegative(),
  // What was actually charged for this line — equals unitPriceCents*quantity
  // for a plain purchase, but a ProductOffer (bundle price, or buy-X-get-Y
  // where quantity includes free units) can make it diverge.
  lineTotalCents: z.number().int().nonnegative(),
  offerId: z.uuid().nullable().optional(),
  // True when this line was added via the upsells system (call-center
  // manual add, admin add-item, or the storefront post-checkout upsell
  // page) rather than being part of the original checkout — lets order
  // detail views show an "Upsell" badge distinct from the original items.
  isUpsell: z.boolean().optional()
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
  state: OrderState.default('PendingCallCenter'),
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
  // Which ProductVariant (if any) the customer selected on the PDP — the
  // server re-validates it belongs to this product and prices off its
  // priceCents/stockQuantity instead of the base product's when present
  // (never trusts a client-submitted price, same rule as offerId below).
  variantId: z.uuid().optional(),
  quantity: z.number().int().positive(),
  // Which ProductOffer (if any) the customer picked for this line — the
  // server re-validates it still belongs to this product, is enabled, and
  // that `quantity` matches what the offer requires before pricing off it
  // (never trusts a client-computed discount).
  offerId: z.uuid().optional()
})
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>

// Anti-abuse fields threaded through both real checkout submits (not the
// abandoned-cart capture — that's a background auto-fire, not a customer
// clicking "place order"). See OrdersService's idempotency-key/duplicate-
// detection/bot-pace handling for how each is actually used server-side.
export const OrderSubmitGuardFields = {
  // Generated once client-side (crypto.randomUUID()) per checkout attempt
  // and reused verbatim across retries of that SAME attempt (a network
  // error/timeout, or a double-click before the button visually disables) —
  // lets the server recognize "this is the same submit coming back" and
  // return the original order instead of creating a second one. A fresh key
  // is only ever generated when the customer starts a genuinely new attempt.
  idempotencyKey: z.uuid().optional(),
  // Epoch ms captured when the checkout/lead form was first rendered —
  // compared against request time server-side as one bot-defense signal
  // (not proof on its own): a real customer takes at least a few seconds to
  // fill in an address, a scripted request replaying this endpoint directly
  // usually doesn't bother sending a plausible value, or sends one that's
  // implausibly recent.
  formLoadedAt: z.number().int().nonnegative().optional()
}

export const CheckoutSchema = z.object({
  phone: PhoneSchema,
  name: z.string().min(1).max(200).optional(),
  address: AddressSchema.omit({ id: true }),
  // wilayaId + shippingType are the authoritative shipping selection — the
  // server re-prices from WilayaShippingRate at order time (never trusts a
  // client-submitted shipping price, same rule as offer pricing).
  // address.region/city still carry the wilaya/commune NAMES for display —
  // wilayaId is what pricing actually keys off.
  wilayaId: z.string(),
  shippingType: ShippingTypeSchema,
  items: z.array(CheckoutItemSchema).min(1),
  // Optional Meta Pixel dedup/match-quality context — see CheckoutTrackingSchema.
  tracking: CheckoutTrackingSchema.optional(),
  ...OrderSubmitGuardFields
})
export type Checkout = z.infer<typeof CheckoutSchema>

// Lead form order — dynamic fields. The storefront sends whatever fields the
// admin configured; the API maps known core keys (name, phone, wilaya, commune)
// to customer/address columns. Extra fields are stored in address.line2 as JSON.
// wilayaId + shippingType are separate, typed, authoritative fields (not part
// of the free-form `fields` map) for the same reason as CheckoutSchema above.
export const LeadOrderSchema = z.object({
  fields: z.record(z.string()),
  wilayaId: z.string(),
  shippingType: ShippingTypeSchema,
  items: z.array(CheckoutItemSchema).min(1),
  // Optional Meta Pixel dedup/match-quality context — see CheckoutTrackingSchema.
  tracking: CheckoutTrackingSchema.optional(),
  // Set when this submit is completing an order the storefront already
  // auto-created as abandoned (see AbandonedLeadOrderSchema below) — the
  // server updates that same row in place (clearing isAbandoned) instead of
  // creating a second order for one funnel visit.
  convertsAbandonedOrderId: z.uuid().optional(),
  ...OrderSubmitGuardFields
})
export type LeadOrder = z.infer<typeof LeadOrderSchema>

// Abandoned-cart order — fired by the storefront when a customer has typed a
// phone number on a lead form and gone idle past the store's configured
// abandonedCartDelaySeconds (StoreSettings) without submitting. Deliberately
// far more lenient than LeadOrderSchema: wilaya/shipping/most fields may not
// be filled in yet, only `fields` (must contain a phone) and the item being
// viewed are guaranteed. See OrdersService.createAbandonedOrder.
export const AbandonedLeadOrderSchema = z.object({
  fields: z.record(z.string()),
  wilayaId: z.string().optional(),
  shippingType: ShippingTypeSchema.optional(),
  items: z.array(CheckoutItemSchema).min(1)
})
export type AbandonedLeadOrder = z.infer<typeof AbandonedLeadOrderSchema>

// Order ID is in the URL; phone is the shared secret that makes this a
// legitimate public lookup instead of "guess a UUID, read anyone's order."
export const TrackOrderQuerySchema = z.object({
  phone: PhoneSchema
})
export type TrackOrderQuery = z.infer<typeof TrackOrderQuerySchema>

export interface OrderTrackingInfo {
  id: string
  state: OrderState
  totalCents: number
  shippingType: ShippingType | null
  shippingPriceCents: number
  createdAt: string
  trackingReference: string | null
}

export interface OrderHistoryItem {
  id: string
  state: OrderState
  totalCents: number
  shippingType: ShippingType | null
  shippingPriceCents: number
  createdAt: string
  items: { productId: string; quantity: number; unitPriceCents: number; lineTotalCents: number; offerId: string | null }[]
}

// Shared shape for a single line item as displayed in admin — used by both
// the order list (compact) and order detail (full) views so "what a line
// item looks like" isn't hand-duplicated per page.
export interface AdminOrderLineItem {
  id: string
  productId: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  offerId: string | null
  isUpsell: boolean
  product: { name: string; slug: string; imageUrl?: string | null }
  // Null when no variant was selected (or the ordered variant was since
  // deleted) — variantLabel is the human-readable "Red / Large" built
  // server-side from the variant's options, so no client has to reconstruct
  // it from raw attribute keys.
  variantId: string | null
  variantLabel: string | null
}

// ADM-04 — the admin order queue response shape. The customer summary is
// joined for the table; PII scoping (phone masking) happens server-side per
// the requesting role (plan §11).
export interface AdminOrderListItem {
  id: string
  state: OrderState
  totalCents: number
  shippingType: ShippingType | null
  shippingPriceCents: number
  createdAt: string
  customer: { id: string; name: string | null; phone: string }
  address: { line1: string; line2: string | null; city: string; region: string; postalCode: string; country: string }
  items: AdminOrderLineItem[]
  shipment?: { courier: { name: string } } | null
  // See Order.isAbandoned's Prisma comment.
  isAbandoned: boolean
  // See FulfillmentMethodSchema's comment — dispatch requires this to be
  // ShippingCompany (with shippingCompanyName set) or Manual, never
  // Unassigned.
  fulfillmentMethod: FulfillmentMethod
  shippingCompanyName: string | null
  // Free-text call-center notes — editable from the Call Center queue and
  // pushed to the Google Sheets integration's Notes column (see
  // GoogleSheetsService.updateNotes); null until an agent adds one.
  notes: string | null
  // Same customer + at least one shared product within the last 2 days —
  // see OrdersService.findRecentDuplicate. Never blocks the order, just
  // flags it so call-center can spot an accidental/bot-driven repeat.
  isDuplicate: boolean
  duplicateOfOrderId: string | null
}

export interface OrderListResponse {
  items: AdminOrderListItem[]
  total: number
  page: number
  pageSize: number
}

// ADM-05 — the full admin order detail response. Everything an ops/call-
// center agent needs on one screen: items (with variant/offer/upsell
// provenance), full shipping picture (type/price/wilaya/city — wilaya is
// address.region, a plain name string, per Address's Prisma comment), the
// shipment/courier state, and reconciliation status.
export interface AdminOrderDetail {
  id: string
  state: OrderState
  totalCents: number
  shippingType: ShippingType | null
  shippingPriceCents: number
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string | null; phone: string }
  address: { line1: string; line2: string | null; city: string; region: string; postalCode: string; country: string }
  items: AdminOrderLineItem[]
  shipment: { courier: { name: string }; trackingReference: string | null; courierStatus: string | null } | null
  cashReconciliation: { expectedCents: number; collectedCents: number | null } | null
  // See Order.isAbandoned's Prisma comment.
  isAbandoned: boolean
  fulfillmentMethod: FulfillmentMethod
  shippingCompanyId: string | null
  shippingCompanyName: string | null
  notes: string | null
  isDuplicate: boolean
  duplicateOfOrderId: string | null
}

// Call-center notes — free text, not part of the order-state machine.
// Nullable to allow clearing a note, not just setting one.
export const UpdateOrderNotesSchema = z.object({
  notes: z.string().max(2000).nullable()
})
export type UpdateOrderNotes = z.infer<typeof UpdateOrderNotesSchema>

// Admin/call-center "add item to order" — covers the upsells system's
// manual-add path (Task: upsells). variantId lets an agent pick a specific
// variant, not just the base product. priceCentsOverride lets an agent
// offer an upsell at a special price instead of the product/variant's
// normal price (omit to use the normal price). Only allowed while the order
// is still in a pre-shipping state — see OrderItemsService's editable-state
// check — adding items after a courier already has the fixed COD amount
// would desync what's actually collectible.
export const AddOrderItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  quantity: z.number().int().positive(),
  priceCentsOverride: z.number().int().nonnegative().optional(),
  isUpsell: z.boolean().optional()
})
export type AddOrderItem = z.infer<typeof AddOrderItemSchema>
