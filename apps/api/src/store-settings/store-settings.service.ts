import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  StoreSettingsSchema,
  StoreTemplateSchema,
  type StoreSettings,
  type UpdateStoreSettings
} from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async getPublic(): Promise<StoreSettings> {
    const row = await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } })
    const raw = row
      ? { activeTemplate: row.activeTemplate, storeName: row.storeName, announcementText: row.announcementText, displayCart: row.displayCart, leadFormConfig: row.leadFormConfig as StoreSettings['leadFormConfig'] }
      : { activeTemplate: 'minimal', storeName: 'Amalice', announcementText: null, displayCart: true }
    const parsed = StoreSettingsSchema.safeParse(raw)
    return parsed.success ? parsed.data : { activeTemplate: 'minimal', storeName: raw.storeName, announcementText: raw.announcementText, displayCart: true }
  }

  async getForAdmin() {
    const row = await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } })
    if (!row) throw new NotFoundException('Store settings not initialized')
    return row
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
    }

    const row = await this.prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: {
        activeTemplate: input.activeTemplate,
        storeName: input.storeName,
        announcementText: input.announcementText ?? null,
        displayCart: input.displayCart,
        leadFormConfig: input.leadFormConfig ? (input.leadFormConfig as object) : Prisma.JsonNull
      },
      create: {
        id: 'singleton',
        activeTemplate: input.activeTemplate,
        storeName: input.storeName,
        announcementText: input.announcementText ?? null,
        displayCart: input.displayCart,
        leadFormConfig: input.leadFormConfig ? (input.leadFormConfig as object) : Prisma.JsonNull
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
      leadFormConfig: row.leadFormConfig as StoreSettings['leadFormConfig']
    })
  }
}
