import { z } from 'zod'

// Quantity-triggered product promos. The storefront PDP shows these as
// pickable "offer cards" — choosing one sets the buy quantity to exactly
// what the offer needs and locks in its pricing, rather than trying to
// auto-detect which offer applies to an arbitrary quantity the customer
// happens to pick.
export const ProductOfferTypeSchema = z.enum(['FixedBundlePrice', 'BuyXGetYFree', 'FreeShipping'])
export type ProductOfferType = z.infer<typeof ProductOfferTypeSchema>

export const ProductOfferSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  type: ProductOfferTypeSchema,
  enabled: z.boolean(),
  requiredQuantity: z.number().int().min(1),
  // BuyXGetYFree only — extra free units on top of requiredQuantity.
  freeQuantity: z.number().int().nonnegative(),
  // FixedBundlePrice only — total price (cents) for requiredQuantity units.
  bundlePriceCents: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional()
})
export type ProductOffer = z.infer<typeof ProductOfferSchema>

// Total units the customer receives when this offer is picked — the
// quantity stepper gets set to this value.
export function offerTotalQuantity(offer: Pick<ProductOffer, 'type' | 'requiredQuantity' | 'freeQuantity'>): number {
  return offer.type === 'BuyXGetYFree' ? offer.requiredQuantity + offer.freeQuantity : offer.requiredQuantity
}

// What the customer pays for that total quantity, given the product's
// current per-unit price. FreeShipping has no price effect (see the Prisma
// model comment) — it's priced like a plain purchase.
export function offerPriceCents(offer: Pick<ProductOffer, 'type' | 'requiredQuantity' | 'bundlePriceCents'>, unitPriceCents: number): number {
  if (offer.type === 'FixedBundlePrice') return offer.bundlePriceCents ?? unitPriceCents * offer.requiredQuantity
  if (offer.type === 'BuyXGetYFree') return unitPriceCents * offer.requiredQuantity
  return unitPriceCents * offer.requiredQuantity
}

const ProductOfferInputBaseSchema = z.object({
  type: ProductOfferTypeSchema,
  // No upper bound — products sold only in fixed lots (see
  // Product.requireOfferSelection) can genuinely need offers well past 50
  // units (e.g. wholesale packs of 100+).
  requiredQuantity: z.number().int().min(1),
  freeQuantity: z.number().int().nonnegative().default(0),
  bundlePriceCents: z.number().int().nonnegative().nullable().optional()
})

export const CreateProductOfferSchema = ProductOfferInputBaseSchema
export type CreateProductOffer = z.infer<typeof CreateProductOfferSchema>

export const UpdateProductOfferSchema = ProductOfferInputBaseSchema.partial().extend({
  enabled: z.boolean().optional()
})
export type UpdateProductOffer = z.infer<typeof UpdateProductOfferSchema>
