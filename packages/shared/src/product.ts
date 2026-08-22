import { z } from 'zod'

// Admin-authored FAQ entry — see Product.faqs's Prisma comment. Answers
// support the same short prose an admin would type into a plain textarea,
// not rich HTML (unlike description).
export const ProductFaqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000)
})
export type ProductFaq = z.infer<typeof ProductFaqSchema>

// Admin-authored spec-table row — see Product.specifications's Prisma
// comment. Deliberately separate from variant attributes: a spec (e.g.
// "Material: Stainless steel") describes the product as a whole, not one
// buyable variant combination.
export const ProductSpecificationSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(300)
})
export type ProductSpecification = z.infer<typeof ProductSpecificationSchema>

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
  // Unlisted-product toggle — false hides it from every discovery surface
  // (catalog, collections, search, home sections, related products) but
  // never blocks direct access via its own product-page or landing-page
  // URL. See Product's Prisma model comment.
  visible: z.boolean().default(true),
  priceCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  // For products only ever sold in fixed lots (wholesale packs of e.g. 40 or
  // 80 units, never a single unit) — when true, the storefront PDP hides its
  // free-quantity stepper and the customer must pick one of this product's
  // enabled ProductOffers (see offer.ts) to set quantity at all, the first
  // enabled one pre-selected by default. See Product's Prisma model comment.
  requireOfferSelection: z.boolean().default(false),
  // Optional richer-PDP content (Impulse's Key Benefits/FAQ/Specifications
  // sections) — empty by default so a template renders nothing rather than
  // fabricate copy when a merchant hasn't filled a section in. This is the
  // read AND write contract: faqs/specifications are nullable Json columns
  // at the DB level (no default — most existing rows are NULL, not []), but
  // every API read path normalizes that null to [] before it reaches
  // frontend code, so nothing consuming the `Product`/`CreateProduct` type
  // needs its own null-check. See Product's Prisma model comment.
  keyBenefits: z.array(z.string().min(1).max(120)).max(8).default([]),
  faqs: z.array(ProductFaqSchema).max(20).default([]),
  specifications: z.array(ProductSpecificationSchema).max(30).default([])
})
export type CreateProduct = z.infer<typeof CreateProductSchema>

export const ProductSchema = CreateProductSchema.extend({
  id: z.uuid()
})
export type Product = z.infer<typeof ProductSchema>

// Query params always arrive as strings over HTTP — z.coerce handles the
// numeric ones whether this schema validates a NestJS @Query() object or a
// parsed URLSearchParams on the storefront side.
// Admin-triggered AI content draft — feeds a raw, messy content dump
// (title/description/specs/FAQ all mixed together, in any language) plus
// optionally some of the product's own photos into a free-tier Gemini text
// model (apps/api/src/landing-pages/gemini.service.ts's draftProductContent)
// and returns a polished, conversion-focused draft for the admin to review
// and edit — this never writes to the product itself; saving still goes
// through the normal PATCH /admin/products/:id the Details/Content tabs
// already use.
export const GenerateProductContentSchema = z.object({
  rawContent: z.string().trim().min(1).max(20000),
  // A subset of the product's own ProductImage.url values, validated
  // server-side against the product's actual gallery — same pattern as
  // GenerateLandingPageSchema.sourceImageUrls (landing-page.ts). Optional:
  // rawContent alone is often enough.
  sourceImageUrls: z.array(z.string()).max(5).default([]),
  instructions: z.string().trim().max(1000).optional()
})
export type GenerateProductContent = z.infer<typeof GenerateProductContentSchema>

// Loose caps here just guard against a malformed model response — the real
// "keep it short and conversion-focused" requirement is enforced by the
// prompt, not by truncating a good draft that ran slightly long.
export const GeneratedProductContentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(20000),
  keyBenefits: z.array(z.string().min(1).max(120)).max(8),
  faqs: z.array(ProductFaqSchema).max(20),
  specifications: z.array(ProductSpecificationSchema).max(30)
})
export type GeneratedProductContent = z.infer<typeof GeneratedProductContentSchema>

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
