import { z } from 'zod'

// ---- Meta ad copy generator --------------------------------------------------
// Several marketing angles per product, each with a primary text and a few
// hooks (headlines). Same honesty rules as the landing pages: every number,
// promotion, discount or guarantee must come from the product's own data.

export const META_AD_LANGUAGES = ['ar', 'fr'] as const
export const MetaAdLanguageSchema = z.enum(META_AD_LANGUAGES)
export type MetaAdLanguage = z.infer<typeof MetaAdLanguageSchema>

// Meta shows ~125 characters of primary text before "See more" and cuts
// headlines around 40, so those are the limits the copy is held to.
export const META_AD_LIMITS = { primaryText: 220, primaryWords: 32, headline: 40, headlineWords: 7, description: 30, descriptionWords: 6 } as const

export const GenerateMetaAdCopySchema = z.object({
  productId: z.uuid(),
  language: MetaAdLanguageSchema.default('ar'),
  angleCount: z.number().int().min(2).max(5).default(3),
  // Optional brief from the owner (target audience, tone). Treated as product
  // information: a promotion may only appear if the owner wrote it here.
  instructions: z.string().trim().max(500).optional()
})
export type GenerateMetaAdCopy = z.infer<typeof GenerateMetaAdCopySchema>

export const MetaAdAngleModelSchema = z.object({
  angle: z.string().trim().min(1).max(60),
  primaryText: z.string().trim().min(1).max(400),
  headlines: z.array(z.string().trim().min(1).max(120)).min(2).max(5),
  description: z.string().trim().min(1).max(120)
})
export type MetaAdAngle = z.infer<typeof MetaAdAngleModelSchema>

export const MetaAdCopyModelSchema = z.object({ angles: z.array(MetaAdAngleModelSchema).min(1).max(8) })

export interface MetaAdCopyResult {
  productId: string
  productName: string
  language: MetaAdLanguage
  angles: MetaAdAngle[]
  // Angles the model wrote that were removed for breaking the rules (invented
  // numbers/promotions, wrong language, too long…), so the owner knows.
  rejected: number
}
