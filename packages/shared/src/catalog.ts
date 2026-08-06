import { z } from 'zod'
import type { ProductOffer } from './offer'
import { PhoneSchema } from './phone'

// SF-17 — collections. `category` is the normalized model behind the
// collection landing pages; the flat string tag on Product is kept for
// back-compat. `featured`/`sortOrder` drive SF-18's marketing home placement.
export const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase, hyphen-separated'),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.url().nullable().optional(),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0)
})
export type Category = z.infer<typeof CategorySchema>

// SF-15 — gallery image. sortOrder defines display order; the lowest is the
// hero shot.
export const ProductImageSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  url: z.url(),
  altText: z.string().max(300).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0)
})
export type ProductImage = z.infer<typeof ProductImageSchema>

// SF-15 — variant. `attributes` is an open map ({"size":"M","color":"Red"})
// rendered as option selectors on the PDP. A product with no variants is
// single-SKU and uses the parent Product's price/stock directly.
export const ProductVariantSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  sku: z.string().min(1).max(100),
  attributes: z.record(z.string()),
  priceCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative()
})
export type ProductVariant = z.infer<typeof ProductVariantSchema>

// SF-16 — review. Rating 1–5, moderation via `approved` (no auto-publish).
// One per customer+product (enforced in the schema, not just here).
export const ReviewSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  customerId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).nullable().optional(),
  body: z.string().max(5000).nullable().optional(),
  approved: z.boolean().default(false),
  createdAt: z.string().datetime().nullable().optional(),
  // Joined customer name for display — not always present (list vs detail).
  customerName: z.string().nullable().optional()
})
export type Review = z.infer<typeof ReviewSchema>

export const CreateReviewSchema = z.object({
  // Phone is the shared secret that identifies the reviewer server-side
  // (same trust model as order tracking) — no OTP/account system.
  phone: PhoneSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional()
})
export type CreateReview = z.infer<typeof CreateReviewSchema>

// SF-16 — aggregate rating summary for a product's approved reviews.
export interface RatingSummary {
  average: number | null
  count: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

// ADM-07 — stock adjustment reason codes. Matches the Prisma enum exactly.
export const StockAdjustmentReasonSchema = z.enum(['Restock', 'Correction', 'Damage', 'Sale', 'Return'])
export type StockAdjustmentReason = z.infer<typeof StockAdjustmentReasonSchema>

export const AdjustStockSchema = z.object({
  // Signed delta — positive for stock-in, negative for stock-out.
  delta: z.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
  reason: StockAdjustmentReasonSchema,
  note: z.string().max(500).optional()
})
export type AdjustStock = z.infer<typeof AdjustStockSchema>

// SEC-03 — audit log entry. Read-only from the admin viewer (ADM-08);
// written by order/product/reconciliation services.
export const AuditActionSchema = z.enum(['Create', 'Update', 'Delete', 'StateTransition'])
export type AuditAction = z.infer<typeof AuditActionSchema>

export const AuditLogSchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
  action: AuditActionSchema,
  entity: z.string(),
  entityId: z.string(),
  metadata: z.unknown().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional()
})
export type AuditLog = z.infer<typeof AuditLogSchema>

// --- Normalized attribute system (full product management) ---
// Attribute = store-wide definition (Color, Size); AttributeOption = its values.
// ProductVariant.options resolves to AttributeOption[] via the VariantOption join.
export const AttributeTypeSchema = z.enum(['Text', 'Color', 'Number', 'Swatch', 'Size', 'Boolean', 'Measurement'])
export type AttributeType = z.infer<typeof AttributeTypeSchema>

export const AttributeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  type: AttributeTypeSchema,
  sortOrder: z.number().int().nonnegative().default(0),
  options: z.array(
    z.object({
      id: z.uuid(),
      value: z.string(),
      displayValue: z.string().nullable().optional(),
      colorHex: z.string().nullable().optional(),
      sortOrder: z.number().int().nonnegative().default(0)
    })
  ).optional()
})
export type Attribute = z.infer<typeof AttributeSchema>

export const AttributeOptionSchema = z.object({
  id: z.uuid(),
  attributeId: z.uuid(),
  value: z.string(),
  displayValue: z.string().nullable().optional(),
  colorHex: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0)
})
export type AttributeOption = z.infer<typeof AttributeOptionSchema>

export const CreateAttributeSchema = z.object({
  name: z.string().min(1).max(100),
  type: AttributeTypeSchema.default('Text')
})
export type CreateAttribute = z.infer<typeof CreateAttributeSchema>

export const CreateAttributeOptionSchema = z.object({
  value: z.string().min(1).max(100),
  displayValue: z.string().max(100).optional(),
  // Hex color swatch — for Color-type attributes.
  colorHex: z.string().max(20).optional(),
  // Image URL for Swatch-type attributes (fabric pattern, material photo).
  swatchUrl: z.url().optional(),
  // Numeric measurement value + unit — for Measurement-type attributes (e.g. "500" + "g").
  measurementValue: z.number().optional(),
  measurementUnit: z.string().max(20).optional()
})
export type CreateAttributeOption = z.infer<typeof CreateAttributeOptionSchema>

// Admin variant create/update — optionIds reference AttributeOption rows.
// The variant manager sends the chosen option for each of the product's attributes.
export const CreateProductVariantSchema = z.object({
  sku: z.string().min(1).max(100),
  priceCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative().default(0),
  optionIds: z.array(z.uuid()).min(1)
})
export type CreateProductVariant = z.infer<typeof CreateProductVariantSchema>

export const UpdateProductVariantSchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  optionIds: z.array(z.uuid()).min(1).optional()
})
export type UpdateProductVariant = z.infer<typeof UpdateProductVariantSchema>

// Admin image create/update
export const CreateProductImageSchema = z.object({
  url: z.url(),
  altText: z.string().max(300).optional(),
  sortOrder: z.number().int().nonnegative().default(0)
})
export type CreateProductImage = z.infer<typeof CreateProductImageSchema>

export const UpdateProductImageSchema = z.object({
  url: z.url().optional(),
  altText: z.string().max(300).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional()
})
export type UpdateProductImage = z.infer<typeof UpdateProductImageSchema>

// Full product detail for the admin editor — includes variants (with their
// resolved options), images, and the product's applied attributes.
export interface AdminProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  categoryId: string | null
  imageUrl: string | null
  featured: boolean
  bestSeller: boolean
  visible: boolean
  priceCents: number
  stockQuantity: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
  images: { id: string; url: string; altText: string | null; sortOrder: number }[]
  variants: {
    id: string
    sku: string
    priceCents: number
    stockQuantity: number
    options: { id: string; value: string; attributeName: string; colorHex: string | null }[]
  }[]
  attributes: { id: string; name: string; type: string; sortOrder: number; options: { id: string; value: string; colorHex: string | null }[] }[]
  offers: ProductOffer[]
}
