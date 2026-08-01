import { BadRequestException, Injectable } from '@nestjs/common'
import {
  APP_IDS,
  APPS_WITH_ACCESS_TOKEN,
  APP_META,
  AppIdSchema,
  GoogleSheetsConfigSchema,
  MetaPixelConfigSchema,
  TikTokPixelConfigSchema,
  type AppId,
  type AppInstallationView,
  type MetaPixelPublic,
  type SendMetaPixelTestEventResult,
  type SendTikTokPixelTestEventResult,
  type TikTokPixelPublic,
  type UpdateAppInstallation
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'
import { MetaConversionsApiService, type MetaCapiCredentials } from './meta-conversions-api.service'
import { TikTokEventsApiService, type TikTokEapiCredentials } from './tiktok-events-api.service'

// Per-appId config validators — the one place a new app's config shape gets
// wired in. Every known app MUST have an entry here; update() rejects any
// appId missing one (belt-and-braces alongside the AppIdSchema enum check).
const CONFIG_SCHEMAS = {
  'meta-pixel': MetaPixelConfigSchema,
  'tiktok-pixel': TikTokPixelConfigSchema,
  'google-sheets': GoogleSheetsConfigSchema
} as const satisfies Record<AppId, unknown>

// Shape shared by every app in APPS_WITH_ACCESS_TOKEN — enough to mask/
// merge-preserve the secret generically without knowing each app's other
// fields (pixelId vs pixelCode, capiEnabled vs eapiEnabled, etc).
interface ConfigWithAccessToken {
  accessToken?: string | null
}

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly metaConversions: MetaConversionsApiService,
    private readonly tiktokEvents: TikTokEventsApiService
  ) {}

  // Config as returned to the admin UI: for apps in APPS_WITH_ACCESS_TOKEN,
  // accessToken is never echoed back in plaintext (it's a write-only
  // secret) — replaced with a `hasAccessToken` boolean. Every other app's
  // config passes through unchanged.
  private maskConfigForAdmin(appId: AppId, config: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!config || !(APPS_WITH_ACCESS_TOKEN as readonly AppId[]).includes(appId)) return config
    const { accessToken, ...rest } = config as ConfigWithAccessToken & Record<string, unknown>
    return { ...rest, hasAccessToken: !!accessToken }
  }

  // Public — the storefront hits these on every page load to decide
  // whether to inject each pixel's script. No auth; no PII; safe to
  // cache-bust on every request since each is a cheap singleton-per-appId
  // read.
  async getPublicMetaPixel(): Promise<MetaPixelPublic> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'meta-pixel' } })
    if (!row?.enabled) return { pixelId: null }
    const parsed = MetaPixelConfigSchema.safeParse(row.config ?? {})
    return { pixelId: parsed.success ? parsed.data.pixelId : null }
  }

  async getPublicTikTokPixel(): Promise<TikTokPixelPublic> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'tiktok-pixel' } })
    if (!row?.enabled) return { pixelCode: null }
    const parsed = TikTokPixelConfigSchema.safeParse(row.config ?? {})
    return { pixelCode: parsed.success ? parsed.data.pixelCode : null }
  }

  // Admin — every known app, merged with its install row (or install
  // defaults if never configured). Drives the Apps list page's cards.
  async listForAdmin(): Promise<AppInstallationView[]> {
    const rows = await this.prisma.appInstallation.findMany({ where: { appId: { in: [...APP_IDS] } } })
    const byAppId = new Map(rows.map((r) => [r.appId, r]))
    return APP_IDS.map((appId) => {
      const row = byAppId.get(appId)
      return {
        appId,
        ...APP_META[appId],
        enabled: row?.enabled ?? false,
        config: this.maskConfigForAdmin(appId, (row?.config as Record<string, unknown> | null) ?? null)
      }
    })
  }

  async update(appId: string, input: UpdateAppInstallation, actor: AuditActor): Promise<AppInstallationView> {
    const idParsed = AppIdSchema.safeParse(appId)
    if (!idParsed.success) {
      throw new BadRequestException(`Unknown app: ${appId}`)
    }
    const id = idParsed.data

    const configSchema = CONFIG_SCHEMAS[id]
    const configParsed = configSchema.safeParse(input.config ?? {})
    if (!configParsed.success) {
      throw new BadRequestException(configParsed.error.issues.map((i) => i.message).join('; '))
    }

    const before = await this.prisma.appInstallation.findUnique({ where: { appId: id } })

    // accessToken is write-only from the admin's perspective for apps in
    // APPS_WITH_ACCESS_TOKEN — the UI can never read it back, so it can
    // only ever send a new value or omit the key. Omitted means "leave the
    // stored token alone" (undefined after Zod parse, since the field has
    // no default); an explicit `null` clears it. Every other app (and
    // every other field) just takes whatever was parsed.
    let configToStore: Record<string, unknown> = configParsed.data as Record<string, unknown>
    if ((APPS_WITH_ACCESS_TOKEN as readonly AppId[]).includes(id)) {
      const parsed = configParsed.data as ConfigWithAccessToken & Record<string, unknown>
      const previousToken = (before?.config as ConfigWithAccessToken | null)?.accessToken ?? null
      configToStore = { ...parsed, accessToken: parsed.accessToken === undefined ? previousToken : parsed.accessToken }
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (!before || before.enabled !== input.enabled) {
      changes.enabled = { from: before?.enabled ?? false, to: input.enabled }
    }
    if (!before || JSON.stringify(before.config ?? {}) !== JSON.stringify(configToStore)) {
      // Audit metadata is a permanent record — mask the secret here too, the
      // same way the admin response does, so the access token never ends up
      // sitting in plaintext in the audit log.
      changes.config = {
        from: this.maskConfigForAdmin(id, (before?.config as Record<string, unknown> | null) ?? null),
        to: this.maskConfigForAdmin(id, configToStore)
      }
    }

    const row = await this.prisma.appInstallation.upsert({
      where: { appId: id },
      update: { enabled: input.enabled, config: configToStore as Prisma.InputJsonValue },
      create: { appId: id, enabled: input.enabled, config: configToStore as Prisma.InputJsonValue }
    })

    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        actor,
        action: 'Update',
        entity: 'AppInstallation',
        entityId: id,
        metadata: changes
      })
    }

    return {
      appId: id,
      ...APP_META[id],
      enabled: row.enabled,
      config: this.maskConfigForAdmin(id, row.config as Record<string, unknown> | null)
    }
  }

  // The full (unmasked) meta-pixel config for server-side use — CAPI event
  // sending needs the real access token, unlike every admin-facing read.
  // Returns null if the app isn't enabled or isn't fully configured for CAPI
  // (pixel id + access token + the capiEnabled toggle all required), so
  // callers can just check truthiness instead of re-deriving this logic.
  async getMetaPixelCapiCredentials(): Promise<MetaCapiCredentials | null> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'meta-pixel' } })
    if (!row?.enabled) return null
    const parsed = MetaPixelConfigSchema.safeParse(row.config ?? {})
    if (!parsed.success || !parsed.data.capiEnabled || !parsed.data.pixelId || !parsed.data.accessToken) return null
    return { pixelId: parsed.data.pixelId, accessToken: parsed.data.accessToken, testEventCode: parsed.data.testEventCode }
  }

  // Same idea as getMetaPixelCapiCredentials, for TikTok's Events API.
  async getTikTokPixelEapiCredentials(): Promise<TikTokEapiCredentials | null> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'tiktok-pixel' } })
    if (!row?.enabled) return null
    const parsed = TikTokPixelConfigSchema.safeParse(row.config ?? {})
    if (!parsed.success || !parsed.data.eapiEnabled || !parsed.data.pixelCode || !parsed.data.accessToken) return null
    return { pixelCode: parsed.data.pixelCode, accessToken: parsed.data.accessToken, testEventCode: parsed.data.testEventCode }
  }

  // Admin "send a test event" action — always includes whatever
  // testEventCode is configured (Meta's Test Events tool requires it to
  // route the event to the live test stream instead of production
  // reporting), and fails loudly (unlike production Purchase events, which
  // fail silently by design) since the whole point is immediate feedback.
  async sendMetaPixelTestEvent(eventName: string): Promise<SendMetaPixelTestEventResult> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'meta-pixel' } })
    const parsed = MetaPixelConfigSchema.safeParse(row?.config ?? {})
    const pixelId = parsed.success ? parsed.data.pixelId : null
    const accessToken = parsed.success ? parsed.data.accessToken : null
    if (!pixelId) throw new BadRequestException('Set a Pixel ID before sending a test event.')
    if (!accessToken) throw new BadRequestException('Set a Conversions API access token before sending a test event.')

    const result = await this.metaConversions.sendEvent(
      { pixelId, accessToken, testEventCode: parsed.success ? parsed.data.testEventCode : null },
      {
        eventName,
        eventId: `test-${Date.now()}`,
        userData: { phone: '+15555550100', ip: '127.0.0.1', userAgent: 'Amalice-Test-Event/1.0' },
        customData: eventName === 'Purchase' ? { value: 1, currency: 'DZD' } : undefined
      }
    )
    return { eventsReceived: result.eventsReceived, fbtraceId: result.fbtraceId, messages: result.messages }
  }

  // Same idea as sendMetaPixelTestEvent, for TikTok's Events API.
  async sendTikTokPixelTestEvent(eventName: string): Promise<SendTikTokPixelTestEventResult> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'tiktok-pixel' } })
    const parsed = TikTokPixelConfigSchema.safeParse(row?.config ?? {})
    const pixelCode = parsed.success ? parsed.data.pixelCode : null
    const accessToken = parsed.success ? parsed.data.accessToken : null
    if (!pixelCode) throw new BadRequestException('Set a Pixel Code before sending a test event.')
    if (!accessToken) throw new BadRequestException('Set an Events API access token before sending a test event.')

    const result = await this.tiktokEvents.sendEvent(
      { pixelCode, accessToken, testEventCode: parsed.success ? parsed.data.testEventCode : null },
      {
        eventName,
        eventId: `test-${Date.now()}`,
        userData: { phone: '+15555550100', ip: '127.0.0.1', userAgent: 'Amalice-Test-Event/1.0' },
        // Same contents[] shape sendPurchaseEvents uses for the real
        // event — a flat content_id isn't valid against TikTok's schema.
        properties: eventName === 'CompletePayment' ? { value: 1, currency: 'DZD', contents: [{ content_id: 'test-product', content_type: 'product', quantity: 1, price: 1 }] } : undefined
      }
    )
    return { eventsReceived: result.eventsReceived, requestId: result.requestId, messages: result.messages }
  }
}
