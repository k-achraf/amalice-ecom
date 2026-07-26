import { z } from 'zod'

// The storefront "apps" registry — the single source of truth for which
// installable apps exist. Mirrors the STORE_TEMPLATES/TEMPLATE_META pattern:
// a fixed slug enum plus a metadata record the admin's Apps list page renders
// from, so adding a new app later is "add a slug + metadata entry + its own
// config schema", not a schema migration for every app.
export const APP_IDS = ['meta-pixel'] as const
export type AppId = (typeof APP_IDS)[number]
export const AppIdSchema = z.enum(APP_IDS)

export const APP_META: Record<AppId, { name: string; description: string; category: string; icon: string }> = {
  'meta-pixel': {
    name: 'Meta Pixel',
    description: 'Track page views, add-to-cart, and purchase events with your Meta (Facebook/Instagram) Pixel to power ad retargeting and measurement.',
    category: 'Analytics & Marketing',
    icon: 'i-lucide-target'
  }
}

// Meta Pixel's own config shape — a numeric pixel ID (Meta pixel IDs are
// 15-16 digit numeric strings; the 10-20 range is deliberately generous
// rather than brittle-exact, since Meta hasn't published a fixed length
// guarantee). Nullable/optional so "enabled but not yet configured" is a
// valid transient state the admin UI can show as "needs a pixel ID."
export const MetaPixelConfigSchema = z.object({
  pixelId: z.string().trim().regex(/^\d{10,20}$/, 'Enter a valid Meta Pixel ID (digits only)').nullable().default(null)
})
export type MetaPixelConfig = z.infer<typeof MetaPixelConfigSchema>

// The public, storefront-facing shape for Meta Pixel specifically — just
// enough to decide whether to inject the script. Config validation for
// admin write already happened server-side against MetaPixelConfigSchema;
// this is a read-only projection of the same shape.
export const MetaPixelPublicSchema = z.object({
  pixelId: z.string().nullable()
})
export type MetaPixelPublic = z.infer<typeof MetaPixelPublicSchema>

// Generic admin-facing view — one row per known app, merging its DB
// install state with its static registry metadata. `config` stays a loose
// record here (the admin list/detail UI doesn't need to know each app's
// exact shape) — validated per-appId server-side on write instead.
export const AppInstallationViewSchema = z.object({
  appId: AppIdSchema,
  name: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z.string(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable()
})
export type AppInstallationView = z.infer<typeof AppInstallationViewSchema>

export const UpdateAppInstallationSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable().optional()
})
export type UpdateAppInstallation = z.infer<typeof UpdateAppInstallationSchema>
