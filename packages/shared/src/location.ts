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
