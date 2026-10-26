import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppsService } from './apps.service'
import { MetaConversionsApiService } from './meta-conversions-api.service'
import { TikTokEventsApiService } from './tiktok-events-api.service'

// Server-side Purchase for Meta CAPI / TikTok Events API, sent when the call
// center (or an admin) confirms an order that was still an abandoned cart: the
// customer never submitted the form, so no browser Purchase exists for it.
// Orders the customer placed themselves send theirs from the browser. The event id is the order id, the same one
// the storefront's browser pixel uses, so each platform dedupes the two.
// Fire-and-forget: a slow or failing platform never affects the confirmation.
@Injectable()
export class PurchaseEventsService {
  private readonly logger = new Logger(PurchaseEventsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly apps: AppsService,
    private readonly meta: MetaConversionsApiService,
    private readonly tiktok: TikTokEventsApiService
  ) {}

  sendForConfirmedOrder(orderId: string): void {
    this.send(orderId).catch((error: Error) => {
      this.logger.warn(`Purchase event for order ${orderId} failed: ${error.message}`)
    })
  }

  private async send(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalCents: true,
        isAbandoned: true,
        customer: { select: { phone: true } },
        funnel: { select: { metaPixelId: true, tiktokPixelCode: true } },
        items: { select: { productId: true, quantity: true, unitPriceCents: true } },
        attribution: { select: { ipAddress: true, userAgent: true, fbp: true, fbc: true, ttp: true, landingUrl: true, pageUrl: true } }
      }
    })
    if (!order) return

    const a = order.attribution
    const value = Math.round(order.totalCents) / 100

    const [metaCreds, tiktokCreds] = await Promise.all([
      this.apps.getMetaPixelCapiCredentials(order.funnel?.metaPixelId),
      this.apps.getTikTokPixelEapiCredentials(order.funnel?.tiktokPixelCode)
    ])

    if (metaCreds) {
      this.meta.fireAndForget(metaCreds, {
        eventName: 'Purchase',
        eventId: order.id,
        eventSourceUrl: a?.pageUrl ?? a?.landingUrl ?? undefined,
        userData: { phone: order.customer.phone, ip: a?.ipAddress ?? undefined, userAgent: a?.userAgent ?? undefined, fbp: a?.fbp ?? undefined, fbc: a?.fbc ?? undefined },
        customData: { value, currency: 'DZD', order_id: order.id, content_ids: order.items.map((i) => i.productId), content_type: 'product' }
      })
    }
    if (tiktokCreds) {
      this.tiktok.fireAndForget(tiktokCreds, {
        eventName: 'CompletePayment',
        eventId: order.id,
        userData: { phone: order.customer.phone, ip: a?.ipAddress ?? undefined, userAgent: a?.userAgent ?? undefined, ttp: a?.ttp ?? undefined },
        properties: {
          value,
          currency: 'DZD',
          contents: order.items.map((i) => ({ content_id: i.productId, content_type: 'product', quantity: i.quantity, price: Math.round(i.unitPriceCents) / 100 }))
        }
      })
    }
  }
}
