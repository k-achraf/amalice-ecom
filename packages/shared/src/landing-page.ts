import { z } from 'zod'

// AI landing page builder — see the ProductLandingPage Prisma model comment
// for the full picture. This file is the single source of truth for the
// section JSON shape stored in that model's `sections` column, plus the
// request/response schemas the admin UI and API share.

export const LandingPageStatusSchema = z.enum(['Pending', 'Generating', 'Completed', 'Failed'])
export type LandingPageStatus = z.infer<typeof LandingPageStatusSchema>

export const LandingPageSectionStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed'])
export type LandingPageSectionStatus = z.infer<typeof LandingPageSectionStatusSchema>

// Which backend generates the section images — see the Prisma model comment
// for the Gemini-needs-billing / Pollinations-is-free-but-lower-quality
// tradeoff. Stored per landing page so "Regenerate" reuses the same choice.
export const LandingPageImageProviderSchema = z.enum(['Gemini', 'Pollinations'])
export type LandingPageImageProvider = z.infer<typeof LandingPageImageProviderSchema>

// One section of the long-scroll image (hero, a feature highlight, the CTA,
// etc). `imageUrl` is null until generation succeeds for this section;
// `sourceImageUrls` records which of the product's photos were sent to the
// model, so a per-section regenerate can reuse the same inputs.
export const LandingPageSectionSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  role: z.enum(['hero', 'feature', 'cta']),
  headline: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  sourceImageUrls: z.array(z.string()),
  status: LandingPageSectionStatusSchema,
  errorMessage: z.string().nullable().optional()
})
export type LandingPageSection = z.infer<typeof LandingPageSectionSchema>

export const ProductLandingPageSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  enabled: z.boolean(),
  status: LandingPageStatusSchema,
  imageProvider: LandingPageImageProviderSchema,
  finalImageUrl: z.string().nullable(),
  sections: z.array(LandingPageSectionSchema),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional()
})
export type ProductLandingPage = z.infer<typeof ProductLandingPageSchema>

// Admin request — (re)generate the whole landing page from scratch.
// sourceImageUrls are a subset of the product's own ProductImage.url values
// (validated server-side against the product's actual gallery, not
// arbitrary URLs) — description is prefilled from Product.description in
// the admin UI but editable before generating, since the raw stored
// description may need trimming/framing for a landing page.
export const GenerateLandingPageSchema = z.object({
  sourceImageUrls: z.array(z.string()).min(1).max(10),
  description: z.string().trim().min(1).max(5000),
  sectionCount: z.number().int().min(3).max(7).default(5),
  imageProvider: LandingPageImageProviderSchema.default('Gemini')
})
export type GenerateLandingPage = z.infer<typeof GenerateLandingPageSchema>

// Toggle whether the storefront PDP shows the generated image.
export const UpdateLandingPageSchema = z.object({
  enabled: z.boolean()
})
export type UpdateLandingPage = z.infer<typeof UpdateLandingPageSchema>

// The public, storefront-facing projection — just enough to decide whether
// to render the long image instead of the normal gallery+description.
export const PublicLandingPageSchema = z.object({
  finalImageUrl: z.string()
})
export type PublicLandingPage = z.infer<typeof PublicLandingPageSchema>
