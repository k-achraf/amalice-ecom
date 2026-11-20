import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'
import {
  DEFAULT_WHATSAPP_ABANDONED_MESSAGE,
  DEFAULT_WHATSAPP_ORDER_MESSAGE,
  WhatsAppConfigSchema,
  normalizeAlgerianPhone,
  parseWhatsappButtonId,
  whatsappButtonId,
  type WhatsAppConfig,
  type WhatsAppMessage
} from '@amalice/shared'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'

const GRAPH_VERSION = 'v21.0'
// WhatsApp error codes meaning "outside the 24h window / free text not allowed" → fall back to the template.
const REOPEN_WINDOW_CODES = new Set([131047, 131026, 470])

export type WhatsAppKind = 'order' | 'abandoned'

export interface WhatsAppCredentials {
  phoneNumberId: string
  accessToken: string
  config: WhatsAppConfig
}

export interface WhatsAppButtonReply {
  from: string
  action: 'confirm' | 'cancel'
  orderId: string
}

interface MessageContext {
  name: string
  orderRef: string
  total: string
  products: string
  store: string
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('whatsapp') private readonly queue: Queue
  ) {}

  // The full (unmasked) config for server-side use, or null when the app is off / not usable.
  async getCredentials(): Promise<WhatsAppCredentials | null> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'whatsapp' } })
    if (!row?.enabled) return null
    const parsed = WhatsAppConfigSchema.safeParse(row.config ?? {})
    if (!parsed.success || !parsed.data.phoneNumberId || !parsed.data.accessToken) return null
    return { phoneNumberId: parsed.data.phoneNumberId, accessToken: parsed.data.accessToken, config: parsed.data }
  }

  async getWebhookSecrets(): Promise<{ verifyToken: string | null; appSecret: string | null }> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'whatsapp' } })
    const parsed = WhatsAppConfigSchema.safeParse(row?.config ?? {})
    if (!row?.enabled || !parsed.success) return { verifyToken: null, appSecret: null }
    return { verifyToken: parsed.data.verifyToken, appSecret: parsed.data.appSecret ?? null }
  }

  // X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret).
  verifySignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
    if (!rawBody || !header) return false
    const expected = Buffer.from('sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex'))
    const given = Buffer.from(header)
    return expected.length === given.length && timingSafeEqual(expected, given)
  }

  // Fire-and-forget entry point used when an order is created. Never throws: a WhatsApp outage must not
  // break checkout. Sends at most once per order (whatsappStatus null).
  sendForOrder(orderId: string, kind: WhatsAppKind): void {
    const run = kind === 'abandoned' ? this.scheduleAbandoned(orderId) : this.sendOrderMessage(orderId, kind)
    run.catch((error: Error) => {
      this.logger.warn(`WhatsApp confirmation failed for order ${orderId}: ${error.message}`)
    })
  }

  // A cart is only messaged after the configured delay, and only if it is STILL abandoned by then (the customer
  // may just be slow: submitting the form turns it into a regular order, which gets the regular message).
  // jobId = order id, so the repeated captures of the same visit schedule one message, not many.
  private async scheduleAbandoned(orderId: string): Promise<void> {
    const creds = await this.getCredentials()
    if (!creds?.config.sendAbandonedMessages) return
    await this.queue.add(
      'abandoned',
      { orderId },
      { delay: creds.config.abandonedDelayMinutes * 60_000, jobId: `wa-abandoned-${orderId}`, removeOnComplete: true, removeOnFail: true }
    )
  }

  // Called by the queue when the delay is over.
  async sendDueAbandoned(orderId: string): Promise<void> {
    await this.sendOrderMessage(orderId, 'abandoned')
  }

  private async sendOrderMessage(orderId: string, kind: WhatsAppKind): Promise<void> {
    const creds = await this.getCredentials()
    if (!creds) return
    const { config } = creds
    if (kind === 'order' ? !config.sendOrderMessages : !config.sendAbandonedMessages) return

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: { select: { name: true } } } } }
    })
    if (!order || order.whatsappStatus) return
    if (kind === 'order' && order.isAbandoned) return
    // Converted to a real order (or handled by staff) during the delay: no abandoned-cart message.
    if (kind === 'abandoned' && !order.isAbandoned) return
    // Only orders still waiting for the call center are worth confirming.
    if (order.state !== 'PendingCallCenter') return

    const store = (await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } }))?.storeName ?? ''
    const ctx: MessageContext = {
      name: order.customer.name?.trim() || '',
      orderRef: orderRef(order.id),
      total: formatDzd(order.totalCents),
      products: order.items.map((i) => `${i.product.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('، '),
      store
    }
    const message = kind === 'order' ? config.orderMessage : config.abandonedMessage
    try {
      const wamid = await this.sendButtons(creds, order.customer.phone, order.id, message, ctx)
      await this.prisma.order.update({
        where: { id: order.id },
        data: { whatsappStatus: 'Sent', whatsappSentAt: new Date(), whatsappMessageId: wamid, whatsappError: null }
      })
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      await this.prisma.order.update({ where: { id: order.id }, data: { whatsappStatus: 'Failed', whatsappError: text.slice(0, 500) } })
      throw error
    }
  }

  // Admin "send me a test" — uses the saved texts with a sample order, no order row involved.
  async sendTest(phone: string, kind: WhatsAppKind): Promise<{ messageId: string | null }> {
    const creds = await this.getCredentials()
    if (!creds) throw new BadRequestException('Enable WhatsApp and save the Phone number ID and access token first.')
    const normalized = normalizeAlgerianPhone(phone)
    if (!/^\+\d{8,15}$/.test(normalized)) throw new BadRequestException('Enter a valid phone number with the country code.')
    const store = (await this.prisma.storeSettings.findUnique({ where: { id: 'singleton' } }))?.storeName ?? ''
    const ctx: MessageContext = { name: 'Test', orderRef: 'TEST0000', total: formatDzd(450000), products: 'Product ×1', store }
    const message = kind === 'order' ? creds.config.orderMessage : creds.config.abandonedMessage
    // The id is a valid shape but matches no order: tapping the button in a test does nothing.
    const wamid = await this.sendButtons(creds, normalized, '00000000-0000-0000-0000-000000000000', message, ctx)
    return { messageId: wamid }
  }

  async sendText(creds: WhatsAppCredentials, phone: string, text: string): Promise<void> {
    await this.post(creds, { messaging_product: 'whatsapp', to: toWaNumber(phone), type: 'text', text: { body: text } })
  }

  // Interactive buttons first (editable free text); on a "24h window" refusal use the approved template.
  private async sendButtons(creds: WhatsAppCredentials, phone: string, orderId: string, message: WhatsAppMessage, ctx: MessageContext): Promise<string | null> {
    const to = toWaNumber(phone)
    const confirmId = whatsappButtonId('confirm', orderId)
    const cancelId = whatsappButtonId('cancel', orderId)
    try {
      return await this.post(creds, {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: fill(message.body, ctx).slice(0, 1024) },
          action: {
            buttons: [
              { type: 'reply', reply: { id: confirmId, title: message.confirmLabel.slice(0, 20) } },
              { type: 'reply', reply: { id: cancelId, title: message.cancelLabel.slice(0, 20) } }
            ]
          }
        }
      })
    } catch (error) {
      const code = (error as WhatsAppApiError).waCode
      if (!message.templateName || !code || !REOPEN_WINDOW_CODES.has(code)) throw error
    }
    return this.post(creds, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.templateLanguage || 'ar' },
        components: [
          {
            type: 'body',
            parameters: [ctx.name || '-', ctx.orderRef, ctx.total, ctx.products || '-', ctx.store || '-'].map((text) => ({ type: 'text', text: text.replace(/\s+/g, ' ').slice(0, 300) }))
          },
          { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: confirmId }] },
          { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: cancelId }] }
        ]
      }
    })
  }

  private async post(creds: WhatsAppCredentials, body: Record<string, unknown>): Promise<string | null> {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    })
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number; error_data?: { details?: string } } }
    if (!res.ok) {
      const err: WhatsAppApiError = new Error(`WhatsApp API ${res.status}: ${json.error?.error_data?.details ?? json.error?.message ?? 'request failed'}`)
      err.waCode = json.error?.code
      throw err
    }
    return json.messages?.[0]?.id ?? null
  }

  // Button taps in a webhook payload (interactive reply, or a template quick-reply).
  extractButtonReplies(payload: unknown): WhatsAppButtonReply[] {
    const out: WhatsAppButtonReply[] = []
    const entries = (payload as { entry?: { changes?: { value?: { messages?: Record<string, any>[] } }[] }[] })?.entry ?? []
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          const id: string | undefined = msg.interactive?.button_reply?.id ?? msg.button?.payload
          const parsed = id ? parseWhatsappButtonId(id) : null
          if (parsed && typeof msg.from === 'string') out.push({ from: msg.from, ...parsed })
        }
      }
    }
    return out
  }

  // The order a tap refers to, only if it may still be answered and the tap came from the customer's own number.
  async findAnswerableOrder(reply: WhatsAppButtonReply) {
    const order = await this.prisma.order.findUnique({ where: { id: reply.orderId }, include: { customer: true } })
    if (!order) return null
    const fromPhone = normalizeAlgerianPhone('+' + reply.from.replace(/^\+/, ''))
    if (order.customer.phone !== fromPhone) return null
    return order
  }

  async markResponded(orderId: string, status: 'Confirmed' | 'Cancelled'): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { whatsappStatus: status, whatsappRespondedAt: new Date() } })
  }

  // Defaults the admin form starts from.
  defaults() {
    return { order: DEFAULT_WHATSAPP_ORDER_MESSAGE, abandoned: DEFAULT_WHATSAPP_ABANDONED_MESSAGE }
  }
}

type WhatsAppApiError = Error & { waCode?: number }

function orderRef(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

function formatDzd(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('en-US')} DA`
}

// +213551234567 → 213551234567 (Cloud API wants digits only).
function toWaNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

function fill(text: string, ctx: MessageContext): string {
  return text
    .replaceAll('{name}', ctx.name || '')
    .replaceAll('{order_ref}', ctx.orderRef)
    .replaceAll('{total}', ctx.total)
    .replaceAll('{products}', ctx.products)
    .replaceAll('{store}', ctx.store)
    .replace(/[ \t]+\n/g, '\n')
}
