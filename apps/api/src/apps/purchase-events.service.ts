import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppsService } from './apps.service'
import type { PixelResendPlatform, PixelResendResult } from '@amalice/shared'
import { MetaConversionsApiService, type MetaCapiEvent } from './meta-conversions-api.service'
import { TikTokEventsApiService, type TikTokEapiEvent } from './tiktok-events-api.service'

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
    const ctx = await this.prepare(orderId)
    if (!ctx) return
    if (ctx.metaEvent) this.meta.fireAndForget(ctx.metaCreds!, ctx.metaEvent)
    if (ctx.tiktokEvent) this.tiktok.fireAndForget(ctx.tiktokCreds!, ctx.tiktokEvent)
  }

  // Admin "resend": the same Purchase event (same event id = the order id), awaited so the admin sees
  // whether each platform accepted it. Meta / TikTok merge two events with the same name and id sent
  // within 48 hours into one, so resending an event that already arrived is not counted twice.
  async resend(orderId: string): Promise<PixelResendResult> {
    const ctx = await this.prepare(orderId)
    const run = async (send: (() => Promise<{ eventsReceived: number }>) | null): Promise<PixelResendPlatform | null> => {
      if (!send) return null
      try {
        const r = await send()
        return { ok: true, message: `Accepted (${r.eventsReceived} event received)` }
      } catch (error) {
        return { ok: false, message: (error as Error).message }
      }
    }
    const [meta, tiktok] = await Promise.all([
      run(ctx?.metaEvent ? () => this.meta.sendEvent(ctx.metaCreds!, ctx.metaEvent!) : null),
      run(ctx?.tiktokEvent ? () => this.tiktok.sendEvent(ctx.tiktokCreds!, ctx.tiktokEvent!) : null)
    ])
    return { meta, tiktok }
  }

  private async prepare(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalCents: true,
        customer: { select: { phone: true } },
        funnel: { select: { metaPixelId: true, tiktokPixelCode: true } },
        items: { select: { productId: true, quantity: true, unitPriceCents: true } },
        attribution: { select: { ipAddress: true, userAgent: true, fbp: true, fbc: true, ttp: true, landingUrl: true, pageUrl: true } }
      }
    })
    if (!order) return null

    const a = order.attribution
    const value = Math.round(order.totalCents) / 100

    const [metaCreds, tiktokCreds] = await Promise.all([
      this.apps.getMetaPixelCapiCredentials(order.funnel?.metaPixelId),
      this.apps.getTikTokPixelEapiCredentials(order.funnel?.tiktokPixelCode)
    ])

    const metaEvent: MetaCapiEvent | null = metaCreds
      ? {
          eventName: 'Purchase',
          eventId: order.id,
          eventSourceUrl: a?.pageUrl ?? a?.landingUrl ?? undefined,
          userData: { phone: order.customer.phone, ip: a?.ipAddress ?? undefined, userAgent: a?.userAgent ?? undefined, fbp: a?.fbp ?? undefined, fbc: a?.fbc ?? undefined },
          customData: { value, currency: 'DZD', order_id: order.id, content_ids: order.items.map((i) => i.productId), content_type: 'product' }
        }
      : null
    const tiktokEvent: TikTokEapiEvent | null = tiktokCreds
      ? {
          eventName: 'CompletePayment',
          eventId: order.id,
          userData: { phone: order.customer.phone, ip: a?.ipAddress ?? undefined, userAgent: a?.userAgent ?? undefined, ttp: a?.ttp ?? undefined },
          properties: {
            value,
            currency: 'DZD',
            contents: order.items.map((i) => ({ content_id: i.productId, content_type: 'product', quantity: i.quantity, price: Math.round(i.unitPriceCents) / 100 }))
          }
        }
      : null
    return { metaCreds, tiktokCreds, metaEvent, tiktokEvent }
  }
}
