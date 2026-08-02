import { z } from 'zod'
import { PhoneSchema } from './phone'

// Admin-configured product-to-product upsell pairings — "customers who buy
// X are offered Y" — powering the upsells system's storefront post-checkout
// page. Deliberately per-trigger-product (not global): a merchant pairs a
// specific upsell with a specific product, same granularity as ProductOffer.
// priceCentsOverride lets the upsell be pitched at a special price distinct
// from the upsell product's normal price (null = normal price).
export const ProductUpsellSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  upsellProductId: z.uuid(),
  enabled: z.boolean(),
  priceCentsOverride: z.number().int().nonnegative().nullable(),
  // Denormalized display fields — joined in server-side so the storefront
  // upsell page and admin list don't need a second product fetch.
  upsellProduct: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    imageUrl: z.string().nullable(),
    priceCents: z.number().int().nonnegative()
  })
})
export type ProductUpsell = z.infer<typeof ProductUpsellSchema>

export const CreateProductUpsellSchema = z.object({
  upsellProductId: z.uuid(),
  priceCentsOverride: z.number().int().nonnegative().nullable().optional()
})
export type CreateProductUpsell = z.infer<typeof CreateProductUpsellSchema>

export const UpdateProductUpsellSchema = z.object({
  enabled: z.boolean().optional(),
  priceCentsOverride: z.number().int().nonnegative().nullable().optional()
})
export type UpdateProductUpsell = z.infer<typeof UpdateProductUpsellSchema>

// Public — what the storefront's post-checkout upsell page shows for a
// just-placed order. Resolved server-side from the order's line items
// against ProductUpsell (first enabled match wins — see
// UpsellsService.forOrder's comment for why only one is ever shown).
export const OrderUpsellOfferSchema = z.object({
  upsellId: z.uuid(),
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    imageUrl: z.string().nullable(),
    priceCents: z.number().int().nonnegative()
  }),
  priceCents: z.number().int().nonnegative()
})
export type OrderUpsellOffer = z.infer<typeof OrderUpsellOfferSchema>

// Accepting the offer just needs the order's phone (same shared-secret
// pattern as order tracking — see TrackOrderQuerySchema) plus which upsell
// and how many units.
export const AcceptOrderUpsellSchema = z.object({
  phone: PhoneSchema,
  upsellId: z.uuid(),
  quantity: z.number().int().positive().default(1)
})
export type AcceptOrderUpsell = z.infer<typeof AcceptOrderUpsellSchema>
