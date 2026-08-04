import { z } from 'zod'

// Third-party courier integrations — DHD first, more providers land here
// over time (see ShippingCompany's Prisma comment). One row per provider.
export const ShippingCompanyProviderSchema = z.enum(['Dhd'])
export type ShippingCompanyProvider = z.infer<typeof ShippingCompanyProviderSchema>

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
