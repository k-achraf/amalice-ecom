import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppsService } from '../apps/apps.service'
import { PixelsService } from '../apps/pixels.service'
import { MetaConversionsApiService, type MetaCapiCredentials } from '../apps/meta-conversions-api.service'
import { TikTokEventsApiService, type TikTokEapiCredentials } from '../apps/tiktok-events-api.service'

const DELIVERED_STATES = ['Delivered', 'CashCollected', 'Reconciled', 'Settled'] as const
// Every state an order can be in AFTER the call center confirmed it (the "Confirmed" event is sent for all of
// them: an order can move on before the sweep runs).
const CONFIRMED_STATES = ['Confirmed', 'OnHold', 'Packed', 'HandedToCourier', 'OutForDelivery', 'DeliveryFailed', 'ReturnedToOrigin', 'Restocked', 'CancelledShipping', ...DELIVERED_STATES] as const
// Meta drops events older than 7 days; stay inside that.
const MAX_AGE_MS = 6 * 24 * 3600 * 1000
const BATCH = 50

type EventKind = 'confirmed' | 'delivered'
const KINDS: Record<EventKind, { states: readonly string[]; sentField: 'confirmedEventSentAt' | 'deliveredEventSentAt'; idPrefix: string }> = {
  confirmed: { states: CONFIRMED_STATES, sentField: 'confirmedEventSentAt', idPrefix: 'confirmed' },
  delivered: { states: DELIVERED_STATES, sentField: 'deliveredEventSentAt', idPrefix: 'delivered' }
}

// Sends the custom order events ("Confirmed", "Delivered" by default; names, platforms and on/off come from the
// Order events app) to Meta CAPI / TikTok Events API, so the ad platforms can learn from real sales.
// A sweep (not a hook) because orders reach these states from several places
// (admin transition, call center, courier webhook, courier sync, Sheets). Each order is
// marked (confirmedEventSentAt / deliveredEventSentAt) once the enabled platforms accepted it.
@Injectable()
export class DeliveryEventsService {
  private readonly logger = new Logger(DeliveryEventsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly apps: AppsService,
    private readonly pixels: PixelsService,
    private readonly meta: MetaConversionsApiService,
    private readonly tiktok: TikTokEventsApiService
  ) {}

  async sweep(): Promise<number> {
    const config = await this.apps.getOrderEventsConfig()
    // Store-wide credentials need the app switched on. A funnel with its own pixels sends to those instead
    // (each with its own token), even while the store-wide app is off.
    const [storeMeta, storeTiktok, ownServerPixels] = await Promise.all([
      this.apps.getMetaPixelCapiCredentials(),
      this.apps.getTikTokPixelEapiCredentials(),
      this.prisma.pixel.count({ where: { serverEventsEnabled: true, accessToken: { not: null } } })
    ])
    if (!storeMeta && !storeTiktok && !ownServerPixels) return 0

    let sent = 0
    for (const kind of ['confirmed', 'delivered'] as const) {
      const setting = config[kind]
      if (!setting.enabled || (!setting.sendToMeta && !setting.sendToTikTok)) continue
      sent += await this.sweepKind(kind, setting, storeMeta, storeTiktok)
    }
    return sent
  }

  private async sweepKind(kind: EventKind, setting: { eventName: string; sendToMeta: boolean; sendToTikTok: boolean }, storeMeta: MetaCapiCredentials | null, storeTiktok: TikTokEapiCredentials | null): Promise<number> {
    const { states, sentField, idPrefix } = KINDS[kind]
    const orders = await this.prisma.order.findMany({
      where: { state: { in: [...states] as never[] }, [sentField]: null, isAbandoned: false, updatedAt: { gte: new Date(Date.now() - MAX_AGE_MS) } },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
      select: {
        id: true,
        totalCents: true,
        updatedAt: true,
        customer: { select: { phone: true } },
        funnel: { select: { pixelIds: true } },
        items: { select: { productId: true, quantity: true, unitPriceCents: true } },
        attribution: { select: { platform: true, ipAddress: true, userAgent: true, fbp: true, fbc: true, ttp: true, pageUrl: true } }
      }
    })

    let sent = 0
    for (const o of orders) {
      const a = o.attribution
      const eventId = `${idPrefix}-${o.id}`
      const eventTime = Math.floor(o.updatedAt.getTime() / 1000)
      const value = Math.round(o.totalCents) / 100
      const own = o.funnel?.pixelIds ?? []
      let metaCreds: MetaCapiCredentials[]
      let tiktokCreds: TikTokEapiCredentials[]
      if (own.length) {
        const t = await this.pixels.serverTargets(own)
        metaCreds = t.meta
        tiktokCreds = t.tiktok
      } else {
        metaCreds = storeMeta ? [storeMeta] : []
        tiktokCreds = storeTiktok ? [storeTiktok] : []
      }
      if (!setting.sendToMeta) metaCreds = []
      if (!setting.sendToTikTok) tiktokCreds = []
      if (!metaCreds.length && !tiktokCreds.length) continue
      let ok = true
      try {
        if (metaCreds.length && (!a || a.platform === 'Meta' || a.fbp || a.fbc)) {
          for (const creds of metaCreds) await this.meta.sendEvent(creds, {
            eventName: setting.eventName,
            eventId,
            eventTime,
            eventSourceUrl: a?.pageUrl ?? undefined,
            userData: { phone: o.customer.phone, ip: a?.ipAddress, userAgent: a?.userAgent, fbp: a?.fbp, fbc: a?.fbc },
            customData: { value, currency: 'DZD', order_id: o.id, content_ids: o.items.map((i) => i.productId), content_type: 'product' }
          })
        }
        if (tiktokCreds.length && (!a || a.platform === 'TikTok' || a.ttp)) {
          for (const creds of tiktokCreds) await this.tiktok.sendEvent(creds, {
            eventName: setting.eventName,
            eventId,
            eventTime,
            eventSourceUrl: a?.pageUrl ?? undefined,
            userData: { phone: o.customer.phone, ip: a?.ipAddress, userAgent: a?.userAgent, ttp: a?.ttp },
            properties: { value, currency: 'DZD', contents: o.items.map((i) => ({ content_id: i.productId, content_type: 'product', quantity: i.quantity, price: Math.round(i.unitPriceCents) / 100 })) }
          })
        }
      } catch (error) {
        ok = false
        this.logger.warn(`${setting.eventName} event for order ${o.id} failed (will retry): ${(error as Error).message}`)
      }
      if (ok) {
        await this.prisma.order.update({ where: { id: o.id }, data: { [sentField]: new Date() } })
        sent++
      }
    }
    return sent
  }
}
