import { z } from 'zod'

// Algeria administrative divisions — reference data, see apps/api/prisma/
// schema.prisma's Wilaya/Commune model comments for provenance. Read-only:
// there is no create/update schema here, only the shape the public
// GET /wilayas and GET /communes endpoints return.
//
// Shipping fields are joined in from WilayaShippingRate (see
// shipping.ts) directly onto the public wilaya shape — the storefront
// already loads the full wilaya list to power the wilaya select, so folding
// delivery availability/pricing in here avoids a second round-trip once a
// wilaya is picked. A wilaya with no configured rate row (the default until
// an admin sets one) comes back with both types disabled and null prices,
// not an error — it just has no shipping options yet.
export const WilayaSchema = z.object({
  id: z.string(),
  name: z.string(),
  homeDeliveryEnabled: z.boolean(),
  homeDeliveryPriceCents: z.number().int().nonnegative().nullable(),
  deskDeliveryEnabled: z.boolean(),
  deskDeliveryPriceCents: z.number().int().nonnegative().nullable()
})
export type Wilaya = z.infer<typeof WilayaSchema>

export const CommuneSchema = z.object({
  id: z.string(),
  name: z.string(),
  postCode: z.string(),
  wilayaId: z.string()
})
export type Commune = z.infer<typeof CommuneSchema>

// AI address cleanup (apps/api/src/ai/address-normalizer.service.ts): a
// read-only SUGGESTION for an order's delivery address, never applied by
// itself — the agent reviews it and applies it through the normal order
// correction (PATCH admin/orders/:id/customer-info), which audits the change.
// wilayaId/communeId always reference real rows (validated server-side); null
// means the AI could not match with confidence.
export const AddressSuggestionSchema = z.object({
  wilayaId: z.string().nullable(),
  wilayaName: z.string().nullable(),
  communeId: z.string().nullable(),
  communeName: z.string().nullable(),
  // The street/neighbourhood part, cleaned of the wilaya/commune words and of
  // noise; never invents details that were not in the original text.
  addressLine1: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
  // True when the suggestion differs from what the order currently stores.
  changed: z.boolean()
})
export type AddressSuggestion = z.infer<typeof AddressSuggestionSchema>
