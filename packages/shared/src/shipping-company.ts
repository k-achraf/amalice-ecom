import { z } from 'zod'

// Third-party courier integrations (see ShippingCompany's Prisma comment). One row per provider.
// DHD and the three Ecotrack-hosted couriers all speak the same Ecotrack API (same endpoints, `api_token`
// query auth, same webhook payload): they differ only in their base URL, so one client serves all four.
export const SHIPPING_COMPANY_PROVIDERS = ['Dhd', 'SwiftExpress', 'Anderson', 'Hr48'] as const
export const ShippingCompanyProviderSchema = z.enum(SHIPPING_COMPANY_PROVIDERS)
export type ShippingCompanyProvider = z.infer<typeof ShippingCompanyProviderSchema>

// Display name and default base URL of each provider (the admin sees both; the URL can differ per account).
export const SHIPPING_COMPANY_CATALOG: Record<ShippingCompanyProvider, { name: string; baseUrl: string }> = {
  Dhd: { name: 'DHD', baseUrl: 'https://platform.dhd-dz.com' },
  SwiftExpress: { name: 'Swift Express', baseUrl: 'https://swift.ecotrack.dz' },
  Anderson: { name: 'Anderson', baseUrl: 'https://anderson-ecommerce.ecotrack.dz' },
  Hr48: { name: '48 Hr Express', baseUrl: 'https://48hr.ecotrack.dz' }
}

// The path segment each provider's inbound webhook lands on: POST /webhooks/<slug>/:shippingCompanyId.
export const SHIPPING_COMPANY_WEBHOOK_SLUG: Record<ShippingCompanyProvider, string> = {
  Dhd: 'dhd',
  SwiftExpress: 'swift-express',
  Anderson: 'anderson',
  Hr48: '48hr'
}

export function providerFromWebhookSlug(slug: string): ShippingCompanyProvider | undefined {
  return SHIPPING_COMPANY_PROVIDERS.find((p) => SHIPPING_COMPANY_WEBHOOK_SLUG[p] === slug)
}

// Admin view — apiToken is write-only, never echoed back (masked to
// hasApiToken), same convention as AppInstallation's accessToken fields.
// Providers the admin hasn't linked yet still appear (isLinked: false,
// hasApiToken: false) so the section can render every supported provider as
// a card, not just the ones already configured.
export const ShippingCompanyViewSchema = z.object({
  // null for a provider that's never been linked — there's no row yet.
  // Assigning an order to a company (FulfillmentService.assignShippingCompany)
  // needs this real id, not just the provider enum, since it's the FK
  // Order.shippingCompanyId actually stores.
  id: z.uuid().nullable(),
  provider: ShippingCompanyProviderSchema,
  name: z.string(),
  baseUrl: z.string(),
  hasApiToken: z.boolean(),
  isLinked: z.boolean(),
  isDefault: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  // Last sync of the courier's wilaya/commune list (needed for address checks).
  locationsSyncedAt: z.string().nullable(),
  communesCount: z.number().int(),
  // The URL to paste into the provider's own webhook configuration (e.g.
  // DHD's "state-webhooks" settings) — null until the company is linked
  // (there's no real id to build it from yet, see `id` above).
  webhookUrl: z.string().nullable(),
  // Same write-only/masked convention as hasApiToken — the actual secret is
  // never echoed back once saved.
  hasWebhookSecret: z.boolean()
})
export type ShippingCompanyView = z.infer<typeof ShippingCompanyViewSchema>

export const LinkShippingCompanySchema = z.object({
  apiToken: z.string().min(1, 'API token is required')
})
export type LinkShippingCompany = z.infer<typeof LinkShippingCompanySchema>

// The HMAC-SHA256 secret the provider's webhook config signs each request
// with (their "Signature: sha256=..." header) — pasted in from whatever
// value their platform generated/the admin set when configuring the
// webhook on their end. Ours never generates this value itself, since it
// has to match exactly what the provider is actually signing with.
export const SetWebhookSecretSchema = z.object({
  secret: z.string().min(1, 'Secret is required').max(255)
})
export type SetWebhookSecret = z.infer<typeof SetWebhookSecretSchema>

// One provider's synced price for one wilaya — reference data only, never
// applied to the live WilayaShippingRate automatically (see
// ShippingCompanyTariff's Prisma comment). Cents fields are null when the
// provider's own response didn't include that service for the wilaya at
// all; 0 vs null both mean "not available" for apply-to-rates purposes, but
// are kept distinct since a provider may legitimately price something free.
export const ShippingCompanyTariffSchema = z.object({
  wilayaId: z.string(),
  wilayaName: z.string(),
  deliveryPriceCents: z.number().int().nonnegative().nullable(),
  deliveryStopdeskPriceCents: z.number().int().nonnegative().nullable()
})
export type ShippingCompanyTariff = z.infer<typeof ShippingCompanyTariffSchema>

export const SyncShippingCompanyTariffsResultSchema = z.object({
  syncedCount: z.number().int().nonnegative(),
  lastSyncedAt: z.string()
})
export type SyncShippingCompanyTariffsResult = z.infer<typeof SyncShippingCompanyTariffsResultSchema>

// Apply synced tariffs into the live WilayaShippingRate — omit wilayaIds to
// apply every wilaya the provider has a synced tariff for. A wilaya's
// stopdesk price of 0 (DHD's "not offered here" convention) applies as desk
// delivery disabled rather than a free desk price.
export const ApplyShippingCompanyTariffsSchema = z.object({
  wilayaIds: z.array(z.string()).optional()
})
export type ApplyShippingCompanyTariffs = z.infer<typeof ApplyShippingCompanyTariffsSchema>

export const ApplyShippingCompanyTariffsResultSchema = z.object({
  appliedCount: z.number().int().nonnegative()
})
export type ApplyShippingCompanyTariffsResult = z.infer<typeof ApplyShippingCompanyTariffsResultSchema>

// One row per inbound courier webhook delivery (see CourierWebhookEvent's
// Prisma comment) — the admin-facing view of DHD's own "Logs de livraison"
// page, scoped to whichever provider's card it's shown under. stateTitle is
// pulled from the stored raw payload at read time (not a separate column)
// since it's purely display sugar over `event`.
export const CourierWebhookLogItemSchema = z.object({
  id: z.uuid(),
  trackingReference: z.string(),
  event: z.string(),
  stateTitle: z.string().nullable(),
  orderId: z.uuid().nullable(),
  applied: z.boolean(),
  error: z.string().nullable(),
  receivedAt: z.string()
})
export type CourierWebhookLogItem = z.infer<typeof CourierWebhookLogItemSchema>

export const CourierWebhookLogResponseSchema = z.object({
  items: z.array(CourierWebhookLogItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
})
export type CourierWebhookLogResponse = z.infer<typeof CourierWebhookLogResponseSchema>

// One row per inbound webhook REQUEST, unconditionally — unlike
// CourierWebhookLogItemSchema above (which can only ever represent a
// delivery that made it all the way through signature verification and
// payload parsing), this captures every attempt including ones rejected
// with 401/400/404, with the raw headers/body that were actually received.
// Exists specifically so "why is the log always empty during a run of
// failures" has an answer — see CourierWebhookLog's Prisma model comment.
export const CourierWebhookRawLogItemSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  statusCode: z.number().int(),
  signatureHeader: z.string().nullable(),
  signatureValid: z.boolean().nullable(),
  errorMessage: z.string().nullable(),
  headers: z.record(z.string(), z.unknown()),
  rawBody: z.string().nullable(),
  receivedAt: z.string()
})
export type CourierWebhookRawLogItem = z.infer<typeof CourierWebhookRawLogItemSchema>

export const CourierWebhookRawLogResponseSchema = z.object({
  items: z.array(CourierWebhookRawLogItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
})
export type CourierWebhookRawLogResponse = z.infer<typeof CourierWebhookRawLogResponseSchema>
