import { z } from 'zod'
import { ShippingTypeSchema } from './shipping'

// POS: staff type in the orders that arrive through social media / chat / phone (a customer who
// messaged the page, a WhatsApp conversation...). They become ordinary orders of the platform
// (same pipeline, risk checks, blacklist, stock rules) with the source recorded as
// OrderAttribution { platform: Organic, channel: 'pos', utmSource: <source id> }.
export const POS_SOURCES = [
  { id: 'facebook', label: 'Facebook / Messenger' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'viber', label: 'Viber' },
  { id: 'phone', label: 'Phone call' },
  { id: 'in_person', label: 'In person' },
  { id: 'other', label: 'Other' }
] as const
export const POS_SOURCE_IDS = POS_SOURCES.map((s) => s.id) as [string, ...string[]]
export const PosSourceSchema = z.enum(POS_SOURCE_IDS)
export type PosSource = z.infer<typeof PosSourceSchema>

export const PosOrderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().positive().multipleOf(0.5),
  // A negotiated price for ONE unit (cents). Absent = the catalogue price of the product / variant.
  unitPriceCents: z.number().int().nonnegative().optional()
})
export type PosOrderItem = z.infer<typeof PosOrderItemSchema>

// POST admin/pos/orders
export const PosOrderSchema = z.object({
  source: PosSourceSchema,
  // Free text about where exactly it came from (page name, WhatsApp number, post link...).
  sourceNote: z.string().trim().max(200).optional(),
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20),
  wilayaId: z.string().min(1),
  // Commune name as spelled in our list (GET /communes?wilayaId=).
  commune: z.string().trim().min(1).max(120),
  addressLine: z.string().trim().max(300).optional(),
  shippingType: ShippingTypeSchema,
  items: z.array(PosOrderItemSchema).min(1).max(30),
  // Charge this delivery fee instead of the wilaya's configured rate (cents). Absent = the configured rate.
  shippingPriceCents: z.number().int().nonnegative().optional(),
  // Internal note (kept on the order) and the remark the courier will receive.
  note: z.string().trim().max(1000).optional(),
  deliveryNote: z.string().trim().max(255).optional(),
  // true = the customer already agreed in the conversation: the order is created CONFIRMED (stock is
  // taken and it goes straight to fulfillment). false = it enters the call-center queue to be called.
  confirmNow: z.boolean().default(true),
  idempotencyKey: z.string().uuid().optional()
})
export type PosOrder = z.infer<typeof PosOrderSchema>

export interface PosOrderResult {
  orderId: string
  state: string
  itemsTotalCents: number
  shippingPriceCents: number
  totalCents: number
  riskLevel: string | null
  // Set when a similar recent order of the same customer exists (flagged, never blocked).
  duplicateOfOrderId: string | null
}

// GET admin/pos/products?search=  (staff roles that cannot open the catalogue still need to pick products)
export interface PosProductVariant {
  id: string
  label: string
  sku: string
  priceCents: number
  stockQuantity: number
}
export interface PosProduct {
  id: string
  name: string
  imageUrl: string | null
  priceCents: number
  stockQuantity: number
  variants: PosProductVariant[]
}

// GET admin/pos/recent  (the latest POS orders, newest first)
export interface PosRecentOrder {
  id: string
  createdAt: string
  state: string
  customerName: string | null
  phone: string
  region: string
  city: string
  totalCents: number
  source: string | null
  sourceNote: string | null
  itemsLabel: string
}
