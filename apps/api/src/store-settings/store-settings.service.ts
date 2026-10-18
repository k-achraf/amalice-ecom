import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import {
  BRAND_FONTS,
  BrandSchema,
  DEFAULT_BRAND,
  StoreSettingsSchema,
  StoreTemplateSchema,
  type Brand,
  type LogoAnalysis,
  type StoreSettings,
  type UpdateStoreSettings
} from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GeminiService } from '../landing-pages/gemini.service'
import { extractLogoPalette } from './logo-palette.util'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif'
}

@Injectable()
export class StoreSettingsService {
  private readonly logger = new Logger(StoreSettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService
  ) {}

  private parseBrand(raw: unknown): Brand | null {
    if (!raw) return null
    const parsed = BrandSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  async getPublic(): Promise<StoreSettings> {
    const row = await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } })
    const raw = row
      ? {
          activeTemplate: row.activeTemplate,
          storeName: row.storeName,
          announcementText: row.announcementText,
          displayCart: row.displayCart,
          leadFormConfig: row.leadFormConfig as StoreSettings['leadFormConfig'],
          abandonedCartDelaySeconds: row.abandonedCartDelaySeconds,
          brand: this.parseBrand(row.brand)
        }
      : { activeTemplate: 'minimal', storeName: 'Amalice', announcementText: null, displayCart: true, abandonedCartDelaySeconds: 60 }
    const parsed = StoreSettingsSchema.safeParse(raw)
    return parsed.success
      ? parsed.data
      : { activeTemplate: 'minimal', storeName: raw.storeName, announcementText: raw.announcementText, displayCart: true, abandonedCartDelaySeconds: 60 }
  }

  // A singleton settings row conceptually always exists — on a fresh
  // production database (never seeded, correctly, per DEPLOYMENT.md) it
  // just hasn't been written yet. Lazily create it with the same defaults
  // getPublic() falls back to, rather than 404ing and leaving the admin UI
  // with no way to ever reach the PUT that would create it.
  async getForAdmin() {
    return this.prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', activeTemplate: 'minimal', storeName: 'Amalice', displayCart: true, abandonedCartDelaySeconds: 60 }
    })
  }

  async update(input: UpdateStoreSettings, actor: AuditActor): Promise<StoreSettings> {
    const parsed = StoreTemplateSchema.safeParse(input.activeTemplate)
    if (!parsed.success) {
      throw new BadRequestException(`Unknown template: ${input.activeTemplate}`)
    }

    const before = await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } })
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (before) {
      if (before.activeTemplate !== input.activeTemplate) {
        changes.activeTemplate = { from: before.activeTemplate, to: input.activeTemplate }
      }
      if (before.storeName !== input.storeName) {
        changes.storeName = { from: before.storeName, to: input.storeName }
      }
      if (before.announcementText !== (input.announcementText ?? null)) {
        changes.announcementText = { from: before.announcementText, to: input.announcementText }
      }
      if (before.displayCart !== input.displayCart) {
        changes.displayCart = { from: before.displayCart, to: input.displayCart }
      }
      if (before.abandonedCartDelaySeconds !== input.abandonedCartDelaySeconds) {
        changes.abandonedCartDelaySeconds = { from: before.abandonedCartDelaySeconds, to: input.abandonedCartDelaySeconds }
      }
    }

    const row = await this.prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: {
        activeTemplate: input.activeTemplate,
        storeName: input.storeName,
        announcementText: input.announcementText ?? null,
        displayCart: input.displayCart,
        leadFormConfig: input.leadFormConfig ? (input.leadFormConfig as object) : Prisma.JsonNull,
        abandonedCartDelaySeconds: input.abandonedCartDelaySeconds
      },
      create: {
        id: 'singleton',
        activeTemplate: input.activeTemplate,
        storeName: input.storeName,
        announcementText: input.announcementText ?? null,
        displayCart: input.displayCart,
        leadFormConfig: input.leadFormConfig ? (input.leadFormConfig as object) : Prisma.JsonNull,
        abandonedCartDelaySeconds: input.abandonedCartDelaySeconds
      }
    })

    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        actor,
        action: 'Update',
        entity: 'StoreSettings',
        entityId: 'singleton',
        metadata: changes
      })
    }

    return StoreSettingsSchema.parse({
      activeTemplate: row.activeTemplate,
      storeName: row.storeName,
      announcementText: row.announcementText,
      displayCart: row.displayCart,
      leadFormConfig: row.leadFormConfig as StoreSettings['leadFormConfig'],
      abandonedCartDelaySeconds: row.abandonedCartDelaySeconds,
      brand: this.parseBrand(row.brand)
    })
  }

  // Brand identity lives behind its own endpoint so the storefront settings
  // form (which PUTs the whole settings object) can never overwrite it.
  async updateBrand(input: Brand, actor: AuditActor): Promise<Brand> {
    const brand = BrandSchema.parse(input)
    const before = await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } })
    const previous = this.parseBrand(before?.brand) ?? DEFAULT_BRAND
    await this.prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: { brand: brand as object },
      create: { id: 'singleton', activeTemplate: 'minimal', storeName: 'Amalice', displayCart: true, abandonedCartDelaySeconds: 60, brand: brand as object }
    })
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of Object.keys(brand) as (keyof Brand)[]) {
      if (previous[key] !== brand[key]) changes[key] = { from: previous[key], to: brand[key] }
    }
    if (Object.keys(changes).length > 0) {
      await this.audit.log({ actor, action: 'Update', entity: 'StoreSettings', entityId: 'singleton', metadata: { brand: changes } })
    }
    return brand
  }

  // Reads an uploaded logo (only files under /uploads — never an arbitrary
  // URL or path), extracts its colour palette and, when Gemini is configured,
  // asks it to match the logo's lettering to one of the storefront's Arabic
  // fonts. The font step is best-effort: a failure leaves fontId null.
  async analyzeLogo(logoUrl: string): Promise<LogoAnalysis> {
    const match = /^\/uploads\/([^/\\]+)$/.exec(logoUrl)
    if (!match) throw new BadRequestException('Upload the logo first, then analyse it.')
    const filename = basename(match[1]!)
    let buffer: Buffer
    try {
      buffer = await readFile(join(process.cwd(), 'uploads', filename))
    } catch {
      throw new BadRequestException('Logo file not found on the server.')
    }

    let colors: Awaited<ReturnType<typeof extractLogoPalette>>
    try {
      colors = await extractLogoPalette(buffer)
    } catch (error) {
      this.logger.warn(`Logo palette extraction failed: ${(error as Error).message}`)
      throw new BadRequestException('Could not read this image. Use a PNG, JPG, WebP or SVG logo.')
    }

    let fontId: LogoAnalysis['fontId'] = null
    let fontReason: string | null = null
    let aiUsed = false
    if (this.gemini.isConfigured()) {
      try {
        const mime = MIME_BY_EXT[extname(filename).toLowerCase()] ?? 'image/png'
        // Gemini can't read SVG: send a PNG rendering instead.
        const isSvg = mime === 'image/svg+xml'
        const image = isSvg ? await sharp(buffer, { density: 200 }).resize(512, 512, { fit: 'inside' }).png().toBuffer() : buffer
        const result = await this.gemini.suggestBrandFont({
          logo: { base64: image.toString('base64'), mimeType: isSvg ? 'image/png' : mime },
          fonts: BRAND_FONTS
        })
        const known = BRAND_FONTS.find((f) => f.id === result.fontId)
        if (known) {
          fontId = known.id
          fontReason = result.reason
          aiUsed = true
        }
      } catch (error) {
        this.logger.warn(`Brand font suggestion failed: ${(error as Error).message}`)
      }
    }

    return { palette: colors.palette, primaryColor: colors.primary, fontId, fontReason, aiUsed }
  }
}
