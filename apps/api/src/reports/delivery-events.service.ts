import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppsService } from '../apps/apps.service'
import { MetaConversionsApiService } from '../apps/meta-conversions-api.service'
import { TikTokEventsApiService } from '../apps/tiktok-events-api.service'

const DELIVERED_STATES = ['Delivered', 'CashCollected', 'Reconciled', 'Settled'] as const
// Meta drops events older than 7 days; stay inside that.
const MAX_AGE_MS = 6 * 24 * 3600 * 1000
const BATCH = 50

// Sends a custom "Delivered" event to Meta CAPI / TikTok Events API once an
// order is really delivered, so the ad platforms can learn from real sales.
// A sweep (not a hook) because orders reach Delivered from several places
// (admin transition, courier webhook, courier sync, Sheets). Each order is
// marked deliveredEventSentAt once the enabled platforms accepted it.
@Injectable()
export class DeliveryEventsService {
  private readonly logger = new Logger(DeliveryEventsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly apps: AppsService,
    private readonly meta: MetaConversionsApiService,
    private readonly tiktok: TikTokEventsApiService
  ) {}

  async sweep(): Promise<number> {
    // Store-wide credentials need the app switched on; an order from a funnel with its own pixel is
    // sent even while it is off (its browser pixel runs regardless), using the saved token.
    const [storeMeta, storeTiktok, anyMeta, anyTiktok] = await Promise.all([
      this.apps.getMetaPixelCapiCredentials(),
      this.apps.getTikTokPixelEapiCredentials(),
      this.apps.getMetaPixelCapiCredentials(undefined, true),
      this.apps.getTikTokPixelEapiCredentials(undefined, true)
    ])
    if (!anyMeta && !anyTiktok) return 0

    const orders = await this.prisma.order.findMany({
      where: { state: { in: [...DELIVERED_STATES] }, deliveredEventSentAt: null, isAbandoned: false, updatedAt: { gte: new Date(Date.now() - MAX_AGE_MS) } },
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
      select: {
        id: true,
        totalCents: true,
        updatedAt: true,
        customer: { select: { phone: true } },
        funnel: { select: { metaPixelId: true, tiktokPixelCode: true } },
        items: { select: { productId: true, quantity: true, unitPriceCents: true } },
        attribution: { select: { platform: true, ipAddress: true, userAgent: true, fbp: true, fbc: true, ttp: true, pageUrl: true } }
      }
    })

    let sent = 0
    for (const o of orders) {
      const a = o.attribution
      const eventId = `delivered-${o.id}`
      const eventTime = Math.floor(o.updatedAt.getTime() / 1000)
      const value = Math.round(o.totalCents) / 100
      const metaCreds = o.funnel?.metaPixelId ? anyMeta : storeMeta
      const tiktokCreds = o.funnel?.tiktokPixelCode ? anyTiktok : storeTiktok
      if (!metaCreds && !tiktokCreds) continue
      let ok = true
      try {
        if (metaCreds && (!a || a.platform === 'Meta' || a.fbp || a.fbc)) {
          await this.meta.sendEvent({ ...metaCreds, pixelId: o.funnel?.metaPixelId || metaCreds.pixelId }, {
            eventName: 'Delivered',
            eventId,
            eventTime,
            eventSourceUrl: a?.pageUrl ?? undefined,
            userData: { phone: o.customer.phone, ip: a?.ipAddress, userAgent: a?.userAgent, fbp: a?.fbp, fbc: a?.fbc },
            customData: { value, currency: 'DZD', order_id: o.id, content_ids: o.items.map((i) => i.productId), content_type: 'product' }
          })
        }
        if (tiktokCreds && (!a || a.platform === 'TikTok' || a.ttp)) {
          await this.tiktok.sendEvent({ ...tiktokCreds, pixelCode: o.funnel?.tiktokPixelCode || tiktokCreds.pixelCode }, {
            eventName: 'Delivered',
            eventId,
            eventTime,
            eventSourceUrl: a?.pageUrl ?? undefined,
            userData: { phone: o.customer.phone, ip: a?.ipAddress, userAgent: a?.userAgent, ttp: a?.ttp },
            properties: { value, currency: 'DZD', contents: o.items.map((i) => ({ content_id: i.productId, content_type: 'product', quantity: i.quantity, price: Math.round(i.unitPriceCents) / 100 })) }
          })
        }
      } catch (error) {
        ok = false
        this.logger.warn(`Delivered event for order ${o.id} failed (will retry): ${(error as Error).message}`)
      }
      if (ok) {
        await this.prisma.order.update({ where: { id: o.id }, data: { deliveredEventSentAt: new Date() } })
        sent++
      }
    }
    return sent
  }
}
