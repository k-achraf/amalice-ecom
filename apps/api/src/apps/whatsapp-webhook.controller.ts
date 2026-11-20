import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Query, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { CALL_CENTER_WORK_STATES } from '@amalice/shared'
import { AdminOrdersService } from '../admin/admin-orders.service'
import type { AuditActor } from '../common/audit.service'
import { WhatsAppService, type WhatsAppButtonReply } from './whatsapp.service'

// The "person" behind a status change made by tapping a WhatsApp button — shows in the order timeline.
const WHATSAPP_ACTOR: AuditActor = { id: 'whatsapp', email: 'whatsapp:customer' }

// Public endpoint Meta calls (register https://<api>/webhooks/whatsapp in the WhatsApp app's webhook settings,
// subscribe to "messages"). GET = ownership handshake, POST = customer taps.
@ApiTags('whatsapp')
@Controller('webhooks/whatsapp')
@SkipThrottle({ default: true })
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name)

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly orders: AdminOrdersService
  ) {}

  @Get()
  async verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
    const { verifyToken } = await this.whatsapp.getWebhookSecrets()
    if (mode === 'subscribe' && verifyToken && token === verifyToken) return res.status(200).type('text/plain').send(challenge)
    throw new ForbiddenException('Verification failed')
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-hub-signature-256') signature: string | undefined, @Body() body: unknown) {
    const { appSecret } = await this.whatsapp.getWebhookSecrets()
    // Without the app secret anyone could confirm/cancel any order by guessing its id, so it is mandatory.
    if (!appSecret || !this.whatsapp.verifySignature(req.rawBody, signature, appSecret)) {
      throw new ForbiddenException('Invalid signature')
    }
    const replies = this.whatsapp.extractButtonReplies(body)
    // Always 200 once the signature is right: Meta retries non-2xx and would re-run taps.
    for (const reply of replies) {
      await this.handleReply(reply).catch((error: Error) => {
        this.logger.warn(`WhatsApp reply for order ${reply.orderId} failed: ${error.message}`)
      })
    }
    return { received: true }
  }

  private async handleReply(reply: WhatsAppButtonReply): Promise<void> {
    const order = await this.whatsapp.findAnswerableOrder(reply)
    if (!order) return
    // First tap wins; later taps (or an order the team already moved on) change nothing.
    if (order.whatsappStatus === 'Confirmed' || order.whatsappStatus === 'Cancelled') return
    if (!CALL_CENTER_WORK_STATES.includes(order.state)) return

    const creds = await this.whatsapp.getCredentials()
    const to: 'Confirmed' | 'Cancelled' = reply.action === 'confirm' ? 'Confirmed' : 'Cancelled'
    await this.orders.transition(order.id, to, WHATSAPP_ACTOR)
    await this.whatsapp.markResponded(order.id, to)
    if (creds) {
      const text = to === 'Confirmed' ? creds.config.confirmedReply : creds.config.cancelledReply
      if (text) await this.whatsapp.sendText(creds, order.customer.phone, text).catch(() => undefined)
    }
  }
}
