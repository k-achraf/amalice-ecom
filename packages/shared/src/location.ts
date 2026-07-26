import { z } from 'zod'

// Algeria administrative divisions — reference data, see apps/api/prisma/
// schema.prisma's Wilaya/Commune model comments for provenance. Read-only:
// there is no create/update schema here, only the shape the public
// GET /wilayas and GET /communes endpoints return.
export const WilayaSchema = z.object({
  id: z.string(),
  name: z.string()
})
export type Wilaya = z.infer<typeof WilayaSchema>

export const CommuneSchema = z.object({
  id: z.string(),
  name: z.string(),
  postCode: z.string(),
  wilayaId: z.string()
})
export type Commune = z.infer<typeof CommuneSchema>
