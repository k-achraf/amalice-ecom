import { z } from 'zod'

// Home delivery (to the door) vs desk delivery (courier office pickup) —
// priced and enabled independently per wilaya (see WilayaShippingRate's
// Prisma comment: remote wilayas often only offer desk delivery).
export const ShippingTypeSchema = z.enum(['Home', 'Desk'])
export type ShippingType = z.infer<typeof ShippingTypeSchema>

// Admin view of one wilaya's rate row — wilayaName is joined in for display,
// not stored on WilayaShippingRate itself.
export const WilayaShippingRateSchema = z.object({
  wilayaId: z.string(),
  wilayaName: z.string(),
  homeDeliveryEnabled: z.boolean(),
  homeDeliveryPriceCents: z.number().int().nonnegative().nullable(),
  deskDeliveryEnabled: z.boolean(),
  deskDeliveryPriceCents: z.number().int().nonnegative().nullable()
})
export type WilayaShippingRate = z.infer<typeof WilayaShippingRateSchema>

// Admin bulk upsert payload — the whole table is edited and saved at once
// (58 wilayas), not row-by-row network calls.
const WilayaShippingRateInputSchema = z.object({
  wilayaId: z.string(),
  homeDeliveryEnabled: z.boolean(),
  homeDeliveryPriceCents: z.number().int().nonnegative().nullable(),
  deskDeliveryEnabled: z.boolean(),
  deskDeliveryPriceCents: z.number().int().nonnegative().nullable()
}).refine((v) => !v.homeDeliveryEnabled || v.homeDeliveryPriceCents !== null, {
  message: 'A price is required when home delivery is enabled',
  path: ['homeDeliveryPriceCents']
}).refine((v) => !v.deskDeliveryEnabled || v.deskDeliveryPriceCents !== null, {
  message: 'A price is required when desk delivery is enabled',
  path: ['deskDeliveryPriceCents']
})

export const UpdateWilayaShippingRatesSchema = z.object({
  rates: z.array(WilayaShippingRateInputSchema)
})
export type UpdateWilayaShippingRates = z.infer<typeof UpdateWilayaShippingRatesSchema>
