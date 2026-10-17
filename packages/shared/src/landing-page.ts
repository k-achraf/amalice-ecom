import { z } from 'zod'
import { ProductVariantSchema, VariantSwatchesSchema } from './catalog'
import { ProductOfferSchema } from './offer'

// AI landing page builder — see the ProductLandingPage Prisma model comment
// for the full picture. This file is the single source of truth for the
// section JSON shape stored in that model's `sections` column, plus the
// request/response schemas the admin UI and API share. A product can have
// MULTIPLE landing pages, each reachable at /lp/:productSlug/:number on the
// storefront (never a raw id/slug/uuid) — separate from and in addition to
// the normal /products/:slug page, never replacing it.

export const LandingPageStatusSchema = z.enum(['Pending', 'Generating', 'Completed', 'Failed'])
export type LandingPageStatus = z.infer<typeof LandingPageStatusSchema>

export const LandingPageSectionStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed'])
export type LandingPageSectionStatus = z.infer<typeof LandingPageSectionStatusSchema>

// Which backend generates the section images — see the Prisma model comment
// for the Gemini-needs-billing / Pollinations-is-free-but-lower-quality
// tradeoff. Stored per landing page so "Regenerate" reuses the same choice.
// Every section is the product's own photo with the copy drawn on it by code.
// 'Gemini' also retouches each photo with the image model (light, colour,
// sharpness, foreign overlay text removed — checked against the original);
// 'Pollinations' / 'Template' only enhance it by code (free, instant, never fails).
export const LandingPageImageProviderSchema = z.enum(['Gemini', 'Pollinations', 'Template'])
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
  // The finished section image (copy rendered in code directly on the product's
  // retouched photo — the AI never draws any text).
  imageUrl: z.string().nullable(),
  // The retouched photo this section is drawn on; kept so the copy can be edited
  // and re-rendered instantly without another AI call.
  sceneUrl: z.string().nullable().optional(),
  sourceImageUrls: z.array(z.string()),
  status: LandingPageSectionStatusSchema,
  errorMessage: z.string().nullable().optional(),
  // Non-fatal note, e.g. AI retouching was unavailable so the photo was enhanced by code.
  warning: z.string().nullable().optional()
})
export type LandingPageSection = z.infer<typeof LandingPageSectionSchema>

// Visual style of the composed sections.
export const LANDING_STYLES = ['vibrant', 'dark', 'light'] as const
export const LandingStyleSchema = z.enum(LANDING_STYLES)
export type LandingStyle = z.infer<typeof LandingStyleSchema>

export const LANDING_LANGUAGES = ['ar', 'fr', 'en'] as const
export const LandingLanguageSchema = z.enum(LANDING_LANGUAGES)
export type LandingLanguage = z.infer<typeof LandingLanguageSchema>

// How a landing page is drawn (kept on the page so edits re-render consistently).
export const LandingDesignSchema = z.object({
  language: LandingLanguageSchema.default('ar'),
  style: LandingStyleSchema.default('vibrant'),
  // Accent colour; derived from the product photo when not chosen.
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()
})
export type LandingDesign = z.infer<typeof LandingDesignSchema>

export const ProductLandingPageSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  // The second segment of /lp/:productSlug/:number — sequential per product
  // (1, 2, 3, ...), assigned automatically at generation time.
  number: z.number().int().positive(),
  name: z.string(),
  enabled: z.boolean(),
  status: LandingPageStatusSchema,
  imageProvider: LandingPageImageProviderSchema,
  finalImageUrl: z.string().nullable(),
  sections: z.array(LandingPageSectionSchema),
  design: LandingDesignSchema.optional(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional()
})
export type ProductLandingPage = z.infer<typeof ProductLandingPageSchema>

// Admin request — generate a NEW landing page for a product (a create, not
// an upsert — a product can have several). sourceImageUrls are a subset of
// the product's own ProductImage.url values (validated server-side against
// the product's actual gallery, not arbitrary URLs) — description is its
// OWN text, never Product.description itself: the admin UI composes it from
// the product's description + key benefits + specifications + FAQ combined
// (as much detail as possible), optionally expanded further via "Improve
// with AI" (ImproveLandingPageDescriptionSchema below), so the cap here has
// to comfortably fit that combined/expanded text, not just a plain
// description. name defaults to "Landing Page"; the URL number is always
// auto-assigned by the server (see landing-pages.service.ts's `nextNumber`),
// never admin-supplied.
export const GenerateLandingPageSchema = z.object({
  sourceImageUrls: z.array(z.string()).min(1).max(10),
  description: z.string().trim().min(1).max(20000),
  sectionCount: z.number().int().min(3).max(7).default(5),
  imageProvider: LandingPageImageProviderSchema.default('Gemini'),
  language: LandingLanguageSchema.default('ar'),
  style: LandingStyleSchema.default('vibrant'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  // Freeform art-direction/copy steer on top of the plain product
  // description — e.g. "target a younger audience", "emphasize the 2-year
  // warranty", "use a beach background". Threaded into both copy drafting
  // and every section's image prompt (gemini.service.ts).
  instructions: z.string().trim().max(2000).optional()
})
export type GenerateLandingPage = z.infer<typeof GenerateLandingPageSchema>

// Regenerating a section optionally carries edit instructions — e.g. "make
// the background blue", "remove the price tag". When the section already
// has a generated image, the image provider treats this as an EDIT of that
// existing image rather than a from-scratch regeneration (see
// gemini.service.ts's editLandingPageImage).
export const RegenerateLandingPageSectionSchema = z.object({
  instructions: z.string().trim().max(1000).optional()
})
export type RegenerateLandingPageSection = z.infer<typeof RegenerateLandingPageSectionSchema>

// "Improve with AI" on the generation form's "description to generate from"
// field — a pure text-in/text-out pass (see gemini.service.ts's
// improveLandingPageDescription) that never touches Product.description or
// any other product content. `text` is admin-composed source material (the
// admin UI seeds it from the product's description + specifications + FAQ +
// key benefits, then lets the admin edit freely before/after improving) —
// this schema and its endpoint don't read the product at all, so there's
// nothing here that COULD write back to it. No landing page needs to exist
// yet either — this runs during the compose step, before "Generate landing
// page" is ever clicked.
export const ImproveLandingPageDescriptionSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  productName: z.string().trim().max(200).optional(),
  instructions: z.string().trim().max(1000).optional()
})
export type ImproveLandingPageDescription = z.infer<typeof ImproveLandingPageDescriptionSchema>

export const ImprovedLandingPageDescriptionSchema = z.object({
  text: z.string().min(1)
})
export type ImprovedLandingPageDescription = z.infer<typeof ImprovedLandingPageDescriptionSchema>

// Rename and/or toggle whether this specific landing page is publicly
// reachable at its URL — both optional, send whichever changed.
export const UpdateLandingPageSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional()
})
export type UpdateLandingPage = z.infer<typeof UpdateLandingPageSchema>

// The public, storefront-facing projection for /lp/:productSlug/:number —
// the stitched image plus just enough product info to render + submit the
// lead form beneath it (see apps/storefront/app/pages/lp/[productSlug]/
// [number].vue). Never exposes admin/generation internals (sections,
// provider, errors). `id` IS exposed (unlike the rest) purely so the
// storefront has a stable entityId to record a view-tracking event against
// (see packages/shared/src/analytics.ts) — it's an opaque uuid, not
// sensitive.
export const PublicLandingPageSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  finalImageUrl: z.string(),
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    priceCents: z.number().int().nonnegative(),
    imageUrl: z.string().nullable(),
    // Sold only in fixed lots — the LP form must enforce an offer is chosen
    // before submission, mirroring the PDP's Product.requireOfferSelection gate.
    requireOfferSelection: z.boolean(),
    // Variants and offers from the product — same data the PDP uses for its
    // own form. Allows the LP funnel to render the variant picker and offer
    // bundle cards that were previously omitted (see ImpulseLandingPageLeadCard).
    variants: z.array(ProductVariantSchema),
    // See VariantSwatchesSchema's comment (catalog.ts) — lets the LP funnel's
    // variant picker show a color swatch the same way the normal PDP does.
    variantSwatches: VariantSwatchesSchema.optional(),
    offers: z.array(ProductOfferSchema)
  })
})
export type PublicLandingPage = z.infer<typeof PublicLandingPageSchema>

// Edit one section's copy by hand and re-render it instantly (no AI call): the
// fix for any wording the model got wrong. Sanitized server-side.
export const UpdateLandingPageSectionSchema = z.object({
  headline: z.string().trim().min(1).max(120),
  body: z.string().trim().max(220)
})
export type UpdateLandingPageSection = z.infer<typeof UpdateLandingPageSectionSchema>

// Change the look (style / accent colour) and re-render every section from the
// stored backgrounds and photos — instant, no AI call.
export const UpdateLandingPageDesignSchema = z.object({
  style: LandingStyleSchema.optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()
})
export type UpdateLandingPageDesign = z.infer<typeof UpdateLandingPageDesignSchema>

// AI-written copy for a funnel's native landing page (headline, subheadline,
// button label) — grounded in the product's own content, validated the same way
// as the image page copy. Not saved: the editor fills its fields and the admin
// reviews before saving.
export const GenerateLandingCopySchema = z.object({
  language: LandingLanguageSchema.default('ar'),
  instructions: z.string().trim().max(1000).optional()
})
export type GenerateLandingCopy = z.infer<typeof GenerateLandingCopySchema>
export interface GeneratedLandingCopy {
  headline: string
  subheadline: string
  ctaLabel: string
  // Problems the validator found and could not fix (the copy is still usable).
  warnings: string[]
}
