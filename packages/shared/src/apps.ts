import { z } from 'zod'
import { OrderAttributionInputSchema } from './attribution'

// The storefront "apps" registry — the single source of truth for which
// installable apps exist. Mirrors the STORE_TEMPLATES/TEMPLATE_META pattern:
// a fixed slug enum plus a metadata record the admin's Apps list page renders
// from, so adding a new app later is "add a slug + metadata entry + its own
// config schema", not a schema migration for every app.
export const APP_IDS = ['meta-pixel', 'tiktok-pixel', 'google-sheets', 'whatsapp', 'order-events'] as const
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
  },
  whatsapp: {
    name: 'WhatsApp',
    description: 'Send each new order (and each abandoned cart) a WhatsApp message with Confirm / Cancel buttons — the customer taps one and the order status updates by itself.',
    category: 'Operations',
    icon: 'i-lucide-message-circle'
  },
  'order-events': {
    name: 'Order events',
    description: 'Send your own events to Meta and TikTok when an order is confirmed or delivered (custom events such as “Confirmed” and “Delivered”), so ad campaigns can optimise for real sales instead of form submits.',
    category: 'Analytics & Marketing',
    icon: 'i-lucide-radio-tower'
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
  ttp: z.string().max(200).optional(),
  // Ad-source attribution (utm_*, campaign/ad ids, click ids, landing page,
  // referrer…) — see attribution.ts. A malformed value is dropped rather than
  // failing validation: attribution is analytics, never a reason to reject an
  // order.
  attribution: OrderAttributionInputSchema.optional().catch(undefined)
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

// ---- WhatsApp order confirmation (WhatsApp Business Cloud API) ----
// Placeholders available in the message text. Replaced server-side when sending.
export const WHATSAPP_PLACEHOLDERS = ['{name}', '{order_ref}', '{total}', '{products}', '{store}'] as const

export const WhatsAppMessageSchema = z.object({
  // Free-text body (interactive message). Max 1024 = WhatsApp limit.
  body: z.string().trim().min(1).max(1024),
  // Button titles — WhatsApp limits them to 20 characters.
  confirmLabel: z.string().trim().min(1).max(20),
  cancelLabel: z.string().trim().min(1).max(20),
  // Optional approved template (quick-reply buttons: Confirm first, Cancel second). Needed to reach customers who
  // never wrote to the business in the last 24h, where WhatsApp refuses free-text messages. Body variables, in order:
  // {{1}} name, {{2}} order ref, {{3}} total, {{4}} products, {{5}} store.
  templateName: z.string().trim().max(512).nullable().default(null),
  templateLanguage: z.string().trim().max(20).default('ar')
})
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>

export const DEFAULT_WHATSAPP_ORDER_MESSAGE: WhatsAppMessage = {
  body: 'مرحباً {name} 👋\nتلقّينا طلبك رقم {order_ref} من {store}.\nالمنتجات: {products}\nالمبلغ عند الاستلام: {total}\n\nهل تؤكد الطلب؟',
  confirmLabel: 'تأكيد الطلب ✅',
  cancelLabel: 'إلغاء الطلب ❌',
  templateName: null,
  templateLanguage: 'ar'
}

export const DEFAULT_WHATSAPP_ABANDONED_MESSAGE: WhatsAppMessage = {
  body: 'مرحباً {name} 👋\nلاحظنا أنك لم تُكمل طلبك رقم {order_ref} من {store}.\nالمنتجات: {products}\nالمبلغ: {total}\n\nهل ترغب في تأكيد الطلب؟',
  confirmLabel: 'نعم، أؤكد ✅',
  cancelLabel: 'لا، إلغاء ❌',
  templateName: null,
  templateLanguage: 'ar'
}

// Secrets (accessToken, appSecret) are write-only: omitted = keep the stored one, null = clear, string = set.
export const WhatsAppConfigSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,25}$/, 'Enter the numeric Phone number ID').nullable().default(null),
  accessToken: z.string().trim().min(1).nullable().optional(),
  appSecret: z.string().trim().min(1).nullable().optional(),
  // Echoed by Meta when you register the webhook (GET challenge).
  verifyToken: z.string().trim().min(8).max(100).nullable().default(null),
  sendOrderMessages: z.boolean().default(true),
  sendAbandonedMessages: z.boolean().default(true),
  // How long to wait after a cart is captured before messaging it. If the customer submits the form in the
  // meantime the order becomes a regular one and gets the regular message instead.
  abandonedDelayMinutes: z.number().int().min(1).max(1440).default(15),
  orderMessage: WhatsAppMessageSchema.default(DEFAULT_WHATSAPP_ORDER_MESSAGE),
  abandonedMessage: WhatsAppMessageSchema.default(DEFAULT_WHATSAPP_ABANDONED_MESSAGE),
  // Short replies sent back after the customer taps a button.
  confirmedReply: z.string().trim().max(500).default('شكراً لك، تم تأكيد طلبك ✅ سنتواصل معك قريباً.'),
  cancelledReply: z.string().trim().max(500).default('تم إلغاء طلبك ❌ نتمنى خدمتك مستقبلاً.')
})
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>

export const WhatsAppAdminConfigSchema = WhatsAppConfigSchema.omit({ accessToken: true, appSecret: true }).extend({
  hasAccessToken: z.boolean(),
  hasAppSecret: z.boolean()
})
export type WhatsAppAdminConfig = z.infer<typeof WhatsAppAdminConfigSchema>

export const SendWhatsAppTestSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  kind: z.enum(['order', 'abandoned']).default('order')
})
export type SendWhatsAppTest = z.infer<typeof SendWhatsAppTestSchema>

// How an order was answered over WhatsApp — shown as a badge in the admin.
export const WHATSAPP_STATUSES = ['Sent', 'Failed', 'Confirmed', 'Cancelled'] as const
export type WhatsAppStatus = (typeof WHATSAPP_STATUSES)[number]

// Button ids carried back in the webhook: "wa:confirm:<orderId>" / "wa:cancel:<orderId>".
export function whatsappButtonId(action: 'confirm' | 'cancel', orderId: string): string {
  return `wa:${action}:${orderId}`
}
export function parseWhatsappButtonId(id: string): { action: 'confirm' | 'cancel'; orderId: string } | null {
  const m = /^wa:(confirm|cancel):([0-9a-f-]{36})$/i.exec(id.trim())
  return m ? { action: m[1] as 'confirm' | 'cancel', orderId: m[2]! } : null
}

// ---- Order events: custom conversion events sent server-side when an order is confirmed / delivered ----
// Names that already mean something to the ad platforms: a custom event must never reuse one (it would be
// counted as a real Purchase, Lead...).
export const RESERVED_AD_EVENT_NAMES = [
  'purchase', 'lead', 'addtocart', 'addtowishlist', 'initiatecheckout', 'addpaymentinfo', 'viewcontent', 'pageview',
  'completeregistration', 'contact', 'customizeproduct', 'donate', 'findlocation', 'schedule', 'search', 'starttrial',
  'submitapplication', 'subscribe', 'completepayment', 'submitform', 'clickbutton', 'download', 'placeanorder'
] as const

export const OrderEventNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_]{1,39}$/, 'Use 2-40 letters, digits or underscores, starting with a letter')
  .refine((n) => !(RESERVED_AD_EVENT_NAMES as readonly string[]).includes(n.toLowerCase()), 'This name is a standard event (Purchase, Lead…): choose another one')

export const OrderEventSettingSchema = z.object({
  enabled: z.boolean(),
  eventName: OrderEventNameSchema,
  sendToMeta: z.boolean().default(true),
  sendToTikTok: z.boolean().default(true)
})
export type OrderEventSetting = z.infer<typeof OrderEventSettingSchema>

export const DEFAULT_ORDER_EVENT_CONFIRMED: OrderEventSetting = { enabled: false, eventName: 'Confirmed', sendToMeta: true, sendToTikTok: true }
// Delivered was sent before this app existed: it stays on by default (and with no saved config at all).
export const DEFAULT_ORDER_EVENT_DELIVERED: OrderEventSetting = { enabled: true, eventName: 'Delivered', sendToMeta: true, sendToTikTok: true }

export const OrderEventsConfigSchema = z.object({
  confirmed: OrderEventSettingSchema.default(DEFAULT_ORDER_EVENT_CONFIRMED),
  delivered: OrderEventSettingSchema.default(DEFAULT_ORDER_EVENT_DELIVERED)
})
export type OrderEventsConfig = z.infer<typeof OrderEventsConfigSchema>
