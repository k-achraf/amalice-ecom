import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CreatePixel, PixelView, SendMetaPixelTestEventResult, UpdatePixel } from '@amalice/shared'
import { isValidPixelCode } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { MetaConversionsApiService, type MetaCapiCredentials } from './meta-conversions-api.service'
import { TikTokEventsApiService, type TikTokEapiCredentials } from './tiktok-events-api.service'

interface PixelRow {
  id: string
  name: string
  platform: string
  pixelId: string
  serverEventsEnabled: boolean
  accessToken: string | null
  testEventCode: string | null
  createdAt: Date
  updatedAt: Date
}

// The pixels a funnel fires, split by platform.
export interface FunnelPixels {
  meta: { id: string; name: string; pixelId: string }[]
  tiktok: { id: string; name: string; pixelId: string }[]
}

// Server-side (Conversions / Events API) targets for a funnel's pixels: only pixels with server events on and a token.
export interface FunnelServerTargets {
  meta: MetaCapiCredentials[]
  tiktok: TikTokEapiCredentials[]
}

function toView(r: PixelRow): PixelView {
  return {
    id: r.id,
    name: r.name,
    platform: r.platform as PixelView['platform'],
    pixelId: r.pixelId,
    serverEventsEnabled: r.serverEventsEnabled,
    hasAccessToken: !!r.accessToken,
    testEventCode: r.testEventCode,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  }
}

@Injectable()
export class PixelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly meta: MetaConversionsApiService,
    private readonly tiktok: TikTokEventsApiService
  ) {}

  async list(): Promise<PixelView[]> {
    const rows = await this.prisma.pixel.findMany({ orderBy: [{ platform: 'asc' }, { createdAt: 'asc' }] })
    return rows.map(toView)
  }

  async create(input: CreatePixel, actor: AuditActor): Promise<PixelView> {
    const row = await this.prisma.pixel.create({
      data: {
        name: input.name,
        platform: input.platform,
        pixelId: input.pixelId,
        serverEventsEnabled: input.serverEventsEnabled,
        accessToken: input.accessToken ?? null,
        testEventCode: input.testEventCode ?? null
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'Pixel', entityId: row.id, metadata: { name: row.name, platform: row.platform, pixelId: row.pixelId } })
    return toView(row)
  }

  async update(id: string, input: UpdatePixel, actor: AuditActor): Promise<PixelView> {
    const current = await this.prisma.pixel.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Pixel not found')
    if (input.pixelId !== undefined && !isValidPixelCode(current.platform as 'Meta' | 'TikTok', input.pixelId)) {
      throw new BadRequestException(current.platform === 'Meta' ? 'Meta pixel id is 5-20 digits' : 'TikTok pixel code is 6-40 letters/digits')
    }
    const row = await this.prisma.pixel.update({
      where: { id },
      data: {
        name: input.name,
        pixelId: input.pixelId,
        serverEventsEnabled: input.serverEventsEnabled,
        // undefined (omitted) keeps the stored token; null clears it.
        accessToken: input.accessToken,
        testEventCode: input.testEventCode === undefined ? undefined : input.testEventCode
      }
    })
    // The token never reaches the audit trail.
    const { accessToken, ...logged } = input
    await this.audit.log({ actor, action: 'Update', entity: 'Pixel', entityId: id, metadata: { ...logged, ...(accessToken !== undefined ? { accessToken: accessToken === null ? 'removed' : 'changed' } : {}) } })
    return toView(row)
  }

  async remove(id: string, actor: AuditActor): Promise<{ ok: true }> {
    const current = await this.prisma.pixel.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Pixel not found')
    await this.prisma.pixel.delete({ where: { id } })
    // Funnels that used it simply stop firing it.
    const funnels = await this.prisma.funnel.findMany({ where: { pixelIds: { has: id } }, select: { id: true, pixelIds: true } })
    for (const f of funnels) {
      await this.prisma.funnel.update({ where: { id: f.id }, data: { pixelIds: f.pixelIds.filter((p) => p !== id) } })
    }
    await this.audit.log({ actor, action: 'Delete', entity: 'Pixel', entityId: id, metadata: { name: current.name, usedByFunnels: funnels.length } })
    return { ok: true }
  }

  // Throws if any id is not a real pixel (used when saving a funnel's selection).
  async assertExist(ids: string[]): Promise<void> {
    if (!ids.length) return
    const count = await this.prisma.pixel.count({ where: { id: { in: ids } } })
    if (count !== new Set(ids).size) throw new BadRequestException('One of the selected pixels no longer exists')
  }

  // What the funnel's page loads in the browser. Empty lists = the funnel has no pixels of its own.
  async forFunnel(pixelIds: string[]): Promise<FunnelPixels> {
    if (!pixelIds.length) return { meta: [], tiktok: [] }
    const rows = await this.prisma.pixel.findMany({ where: { id: { in: pixelIds } }, orderBy: { createdAt: 'asc' } })
    const pick = (platform: string) => rows.filter((r) => r.platform === platform).map((r) => ({ id: r.id, name: r.name, pixelId: r.pixelId }))
    return { meta: pick('Meta'), tiktok: pick('TikTok') }
  }

  async serverTargets(pixelIds: string[]): Promise<FunnelServerTargets> {
    if (!pixelIds.length) return { meta: [], tiktok: [] }
    const rows = await this.prisma.pixel.findMany({ where: { id: { in: pixelIds }, serverEventsEnabled: true, accessToken: { not: null } } })
    return {
      // Never the test event code: with one set, the platform files every event under "Test events" and counts none.
      meta: rows.filter((r) => r.platform === 'Meta').map((r) => ({ pixelId: r.pixelId, accessToken: r.accessToken! })),
      tiktok: rows.filter((r) => r.platform === 'TikTok').map((r) => ({ pixelCode: r.pixelId, accessToken: r.accessToken! }))
    }
  }

  // Admin "send a test event" for one saved pixel. Includes its test event code and fails loudly.
  async sendTestEvent(id: string, eventName: string): Promise<SendMetaPixelTestEventResult> {
    const p = await this.prisma.pixel.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Pixel not found')
    if (!p.accessToken) throw new BadRequestException('Add an access token to this pixel before sending a test event.')
    const userData = { phone: '+15555550100', ip: '127.0.0.1', userAgent: 'Amalice-Test-Event/1.0' }
    const eventId = `test-${Date.now()}`
    if (p.platform === 'Meta') {
      const r = await this.meta.sendEvent(
        { pixelId: p.pixelId, accessToken: p.accessToken, testEventCode: p.testEventCode },
        { eventName, eventId, userData, customData: eventName === 'Purchase' ? { value: 1, currency: 'DZD' } : undefined }
      )
      return { eventsReceived: r.eventsReceived, fbtraceId: r.fbtraceId, messages: r.messages }
    }
    const r = await this.tiktok.sendEvent(
      { pixelCode: p.pixelId, accessToken: p.accessToken, testEventCode: p.testEventCode },
      {
        eventName,
        eventId,
        userData,
        properties: eventName === 'CompletePayment' ? { value: 1, currency: 'DZD', contents: [{ content_id: 'test-product', content_type: 'product', quantity: 1, price: 1 }] } : undefined
      }
    )
    return { eventsReceived: r.eventsReceived, fbtraceId: r.requestId ?? null, messages: r.messages }
  }
}
