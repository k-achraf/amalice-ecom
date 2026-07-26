import { BadRequestException, Injectable } from '@nestjs/common'
import {
  APP_IDS,
  APP_META,
  AppIdSchema,
  MetaPixelConfigSchema,
  type AppId,
  type AppInstallationView,
  type MetaPixelPublic,
  type UpdateAppInstallation
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Per-appId config validators — the one place a new app's config shape gets
// wired in. Every known app MUST have an entry here; update() rejects any
// appId missing one (belt-and-braces alongside the AppIdSchema enum check).
const CONFIG_SCHEMAS = {
  'meta-pixel': MetaPixelConfigSchema
} as const satisfies Record<AppId, unknown>

@Injectable()
export class AppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // Public — the storefront hits this on every page load to decide whether
  // to inject the Meta Pixel script. No auth; no PII; safe to cache-bust on
  // every request since it's a cheap singleton-per-appId read.
  async getPublicMetaPixel(): Promise<MetaPixelPublic> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'meta-pixel' } })
    if (!row?.enabled) return { pixelId: null }
    const parsed = MetaPixelConfigSchema.safeParse(row.config ?? {})
    return { pixelId: parsed.success ? parsed.data.pixelId : null }
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
        config: (row?.config as Record<string, unknown> | null) ?? null
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
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (!before || before.enabled !== input.enabled) {
      changes.enabled = { from: before?.enabled ?? false, to: input.enabled }
    }
    if (!before || JSON.stringify(before.config ?? {}) !== JSON.stringify(configParsed.data)) {
      changes.config = { from: before?.config ?? null, to: configParsed.data }
    }

    const row = await this.prisma.appInstallation.upsert({
      where: { appId: id },
      update: { enabled: input.enabled, config: configParsed.data },
      create: { appId: id, enabled: input.enabled, config: configParsed.data }
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
      config: row.config as Record<string, unknown> | null
    }
  }
}
