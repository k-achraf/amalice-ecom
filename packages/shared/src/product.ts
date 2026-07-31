import { z } from 'zod'

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase, hyphen-separated'),
  // Prisma returns null (not undefined) for an unset nullable column — the
  // API response always has these keys present, just possibly null.
  // Accepting null here too (not just undefined) keeps this schema
  // structurally assignable from whatever Prisma actually returns.
  // Stores Tiptap-produced HTML (rich text incl. embedded <img>/<video> tags
  // pointing at uploaded assets), not plain text — hence the much larger cap
  // than a plain description would need.
  description: z.string().max(20000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  // SF-17 — normalized FK to Category. Optional: seeded/legacy products may
  // only carry the flat `category` tag. `category` is kept for back-compat;
  // `categoryId` is authoritative when set.
  categoryId: z.uuid().nullable().optional(),
  imageUrl: z.url().nullable().optional(),
  // SF-18 — curated marketing-home placement flags, not a separate table.
  featured: z.boolean().default(false),
  bestSeller: z.boolean().default(false),
  priceCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5)
})
export type CreateProduct = z.infer<typeof CreateProductSchema>

export const ProductSchema = CreateProductSchema.extend({
  id: z.uuid()
})
export type Product = z.infer<typeof ProductSchema>

// Query params always arrive as strings over HTTP — z.coerce handles the
// numeric ones whether this schema validates a NestJS @Query() object or a
// parsed URLSearchParams on the storefront side.
export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().max(100).optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  q: z.string().max(200).optional()
})
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  pageSize: number
}
