import { z } from 'zod'

// The storefront "apps" registry — the single source of truth for which
// installable apps exist. Mirrors the STORE_TEMPLATES/TEMPLATE_META pattern:
// a fixed slug enum plus a metadata record the admin's Apps list page renders
// from, so adding a new app later is "add a slug + metadata entry + its own
// config schema", not a schema migration for every app.
export const APP_IDS = ['meta-pixel', 'tiktok-pixel', 'google-sheets'] as const
export type AppId = (typeof APP_IDS)[number]
export const AppIdSchema = z.enum(APP_IDS)

export const APP_META: Record<AppId, { name: string; description: string; category: string; icon: string }> = {
  'meta-pixel': {
    name: 'Meta Pixel',
    description: 'Track page views, add-to-cart, and purchase events with your Meta (Facebook/Instagram) Pixel to power ad retargeting and measurement.',
    category: 'Analytics & Marketing',
    icon: 'i-lucide-target'
  },
  'tiktok-pixel': {
    name: 'TikTok Pixel',
    description: 'Track page views, add-to-cart, and purchase events with your TikTok Pixel to power ad retargeting and measurement.',
    category: 'Analytics & Marketing',
    icon: 'i-lucide-music-2'
  },
  'google-sheets': {
    name: 'Google Sheets',
    description: 'Push every order to a connected Google Sheet as it comes in, and keep its status column in sync as you work the order — route different products to different sheets, or all of them to one.',
    category: 'Operations',
    icon: 'i-lucide-table'
  }
}

// Apps whose config carries a write-only server-side API secret — used by
// AppsService to generically mask/merge-preserve that field instead of
// hardcoding per-app logic. Both pixel apps have the same shape here
// (pixel identifier + capiEnabled-style toggle + accessToken + optional
// test event code); a future non-pixel app with a secret would just add
// itself to this list rather than needing bespoke handling.
export const APPS_WITH_ACCESS_TOKEN = ['meta-pixel', 'tiktok-pixel'] as const satisfies readonly AppId[]

// Meta Pixel's own config shape — a numeric pixel ID (Meta pixel IDs are
// 15-16 digit numeric strings; the 10-20 range is deliberately generous
// rather than brittle-exact, since Meta hasn't published a fixed length
// guarantee). Nullable/optional so "enabled but not yet configured" is a
// valid transient state the admin UI can show as "needs a pixel ID."
//
// This is the FULL write-side shape, including the Conversions API (CAPI)
// access token — the one field that must never round-trip back to the
// browser. `accessToken` is deliberately `.optional()` (not just
// `.nullable()`): omitting the key means "leave the currently stored token
// alone" (the admin UI never re-sends a token it can't read back), an
// explicit `null` clears it, and a string sets it. AppsService.update()
// implements that merge — this schema only validates shape.
export const MetaPixelConfigSchema = z.object({
  pixelId: z.string().trim().regex(/^\d{10,20}$/, 'Enter a valid Meta Pixel ID (digits only)').nullable().default(null),
  // Server-side event sending (Conversions API) — off by default even if a
  // token is present, so enabling the pixel alone never starts a second
  // (server) tracking channel silently.
  capiEnabled: z.boolean().default(false),
  accessToken: z.string().trim().min(1).nullable().optional(),
  // From Meta Events Manager's "Test Events" tab — scopes CAPI calls to the
  // live test-event stream instead of production reporting. Optional; only
  // needed while validating the integration.
  testEventCode: z.string().trim().max(50).nullable().optional()
})
export type MetaPixelConfig = z.infer<typeof MetaPixelConfigSchema>

// What the admin UI actually reads back after a save (and in the apps
// list) — accessToken is REPLACED with a boolean, never echoed in
// plaintext. Mirrors MetaPixelConfigSchema minus the secret.
export const MetaPixelAdminConfigSchema = z.object({
  pixelId: z.string().nullable(),
  capiEnabled: z.boolean(),
  hasAccessToken: z.boolean(),
  testEventCode: z.string().nullable()
})
export type MetaPixelAdminConfig = z.infer<typeof MetaPixelAdminConfigSchema>

// The public, storefront-facing shape for Meta Pixel specifically — just
// enough to decide whether to inject the script. Config validation for
// admin write already happened server-side against MetaPixelConfigSchema;
// this is a read-only projection of the same shape.
export const MetaPixelPublicSchema = z.object({
  pixelId: z.string().nullable()
})
export type MetaPixelPublic = z.infer<typeof MetaPixelPublicSchema>

// Body for the admin "send a test event" action — fires one synthetic
// event at Meta's Conversions API using the stored pixel/token/test-event
// code, so the store owner can watch it land in Events Manager's Test
// Events tab without waiting for a real order.
export const SendMetaPixelTestEventSchema = z.object({
  eventName: z.enum(['Purchase', 'InitiateCheckout', 'AddToCart', 'PageView', 'Lead']).default('Purchase')
})
export type SendMetaPixelTestEvent = z.infer<typeof SendMetaPixelTestEventSchema>

// Meta's response to a successful /events call — surfaced as-is to the
// admin UI so "it worked" isn't just a generic toast; fbtrace_id is what
// Meta support asks for when debugging a delivery issue.
export interface SendMetaPixelTestEventResult {
  eventsReceived: number
  fbtraceId: string | null
  messages: string[]
}

// TikTok Pixel — same shape and same write-only accessToken semantics as
// MetaPixelConfigSchema above (see that comment for the omit/null/string
// merge-preserve rule). TikTok Pixel Codes are alphanumeric (not numeric
// like Meta's), typically ~20 characters, e.g. "CT8QTHRC77U9GJ0ON6E0".
export const TikTokPixelConfigSchema = z.object({
  pixelCode: z.string().trim().regex(/^[A-Za-z0-9]{10,30}$/, 'Enter a valid TikTok Pixel Code (letters/digits)').nullable().default(null),
  // TikTok's server-side channel is called the Events API (EAPI) — same
  // role as Meta's Conversions API, different name.
  eapiEnabled: z.boolean().default(false),
  accessToken: z.string().trim().min(1).nullable().optional(),
  // From TikTok Events Manager → Test Events — same purpose as Meta's.
  testEventCode: z.string().trim().max(50).nullable().optional()
})
export type TikTokPixelConfig = z.infer<typeof TikTokPixelConfigSchema>

export const TikTokPixelAdminConfigSchema = z.object({
  pixelCode: z.string().nullable(),
  eapiEnabled: z.boolean(),
  hasAccessToken: z.boolean(),
  testEventCode: z.string().nullable()
})
export type TikTokPixelAdminConfig = z.infer<typeof TikTokPixelAdminConfigSchema>

export const TikTokPixelPublicSchema = z.object({
  pixelCode: z.string().nullable()
})
export type TikTokPixelPublic = z.infer<typeof TikTokPixelPublicSchema>

export const SendTikTokPixelTestEventSchema = z.object({
  eventName: z.enum(['CompletePayment', 'InitiateCheckout', 'AddToCart', 'ViewContent', 'SubmitForm']).default('CompletePayment')
})
export type SendTikTokPixelTestEvent = z.infer<typeof SendTikTokPixelTestEventSchema>

// TikTok's response to a successful /event/track/ call.
export interface SendTikTokPixelTestEventResult {
  eventsReceived: number
  requestId: string | null
  messages: string[]
}

// Google Sheets has no per-app config of its own — the service account
// credentials that authenticate to the Sheets API are a global env-level
// secret (there's only ever one), and which sheets exist / which products
// route to them live in their own dedicated tables (GoogleSheet,
// ProductGoogleSheet — see the Prisma schema), not this JSON blob. The
// AppInstallation row for 'google-sheets' exists purely so this app shows up
// in the generic /admin/apps list with the same enabled-toggle semantics as
// every other app (a master on/off switch checked before any sheet push).
export const GoogleSheetsConfigSchema = z.object({})
export type GoogleSheetsConfig = z.infer<typeof GoogleSheetsConfigSchema>

// Optional client-side tracking context forwarded alongside a checkout
// request — never required, never blocks an order if absent or stale.
// `eventId` is the SAME id both pixels' browser-side purchase call uses,
// so each platform's server API dedupes the browser and server events into
// one. `fbp`/`fbc` are Meta's first-party cookies; `ttp` is TikTok's
// equivalent (auto-set by the TikTok pixel script once loaded). All four
// are commonly absent (no cookie consent, ad blocker, organic visit,
// or simply the other platform's pixel isn't installed) — that's fine,
// both server APIs work without them, just with weaker match quality.
export const CheckoutTrackingSchema = z.object({
  eventId: z.string().max(200).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(200).optional(),
  ttp: z.string().max(200).optional()
})
export type CheckoutTracking = z.infer<typeof CheckoutTrackingSchema>

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
