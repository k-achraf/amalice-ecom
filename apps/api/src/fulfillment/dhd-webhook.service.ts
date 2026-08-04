import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'
import { DHD_WEBHOOK_EVENT_TO_STATE, DhdWebhookPayloadSchema, isValidTransition, type DhdWebhookPayload } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../common/audit.service'
import { GoogleSheetsService } from '../apps/google-sheets.service'

// DHD's "state-webhooks" inbound handler — see fulfillment/webhooks.controller.ts
// for the route. Every event is logged to CourierWebhookEvent regardless of
// whether it ends up changing anything (audit trail + the idempotency
// mechanism DHD's own docs recommend: "use tracking + event as a dedup
// key" — the table's unique constraint on exactly that pair IS the dedup).
@Injectable()
export class DhdWebhookService {
  private readonly logger = new Logger(DhdWebhookService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly googleSheets: GoogleSheetsService
  ) {}

  // Signature header is "sha256=<hex hmac>" — verified against the RAW
  // request body (main.ts's rawBody:true option), not the re-serialized
  // parsed JSON, since re-serialization isn't guaranteed byte-identical to
  // what DHD actually signed.
  private verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
    if (!signatureHeader) return false
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedBuf = Buffer.from(expected)
    const actualBuf = Buffer.from(signatureHeader)
    if (expectedBuf.length !== actualBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  }

  async handle(shippingCompanyId: string, rawBody: Buffer | undefined, signatureHeader: string | undefined, rawPayload: unknown): Promise<{ received: true; applied: boolean }> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
    if (!company || company.provider !== 'Dhd') throw new NotFoundException('Unknown webhook endpoint')

    if (!company.webhookSecret) {
      throw new BadRequestException('This webhook has no secret configured yet — set one under Settings → Shipping Companies before enabling it in DHD.')
    }
    if (!rawBody || !this.verifySignature(rawBody, signatureHeader, company.webhookSecret)) {
      this.logger.warn(`DHD webhook: signature verification failed for shipping company ${shippingCompanyId}`)
      throw new UnauthorizedException('Invalid signature')
    }

    const parsed = DhdWebhookPayloadSchema.safeParse(rawPayload)
    if (!parsed.success) throw new BadRequestException('Malformed webhook payload')
    const payload: DhdWebhookPayload = parsed.data

    // Idempotency — DHD's own docs recommend tracking + event as the dedup
    // key for retried deliveries; this table's unique constraint on exactly
    // that pair is what makes a retry a safe no-op instead of reprocessing.
    const existing = await this.prisma.courierWebhookEvent.findUnique({
      where: { shippingCompanyId_trackingReference_event: { shippingCompanyId, trackingReference: payload.data.tracking, event: payload.event } }
    })
    if (existing) {
      return { received: true, applied: existing.applied }
    }

    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingReference: payload.data.tracking },
      include: { order: true, courier: true }
    })

    let applied = false
    let error: string | null = null
    let orderId: string | null = shipment?.order.id ?? null

    if (!shipment) {
      error = 'No shipment matches this tracking reference'
    } else if (shipment.courier.slug !== company.provider.toLowerCase()) {
      // Extremely unlikely (would require a tracking-reference collision
      // across couriers) but worth guarding — never let one company's
      // webhook mutate a shipment that belongs to a different courier.
      error = `Tracking reference belongs to a different courier (${shipment.courier.slug})`
    } else {
      applied = await this.applyToShipment(shipment, payload)
    }

    await this.prisma.courierWebhookEvent.create({
      data: {
        shippingCompanyId,
        trackingReference: payload.data.tracking,
        event: payload.event,
        stateId: payload.data.state.id,
        payload: payload as object,
        orderId,
        applied,
        error
      }
    })

    if (error) this.logger.warn(`DHD webhook: ${error} (tracking ${payload.data.tracking}, event ${payload.event})`)

    return { received: true, applied }
  }

  private async applyToShipment(
    shipment: { id: string; orderId: string; courierStatus: string | null; order: { id: string; state: string } },
    payload: DhdWebhookPayload
  ): Promise<boolean> {
    const driverName = payload.data.driver?.name?.trim() || undefined
    const driverPhone = payload.data.driver?.phone?.trim() || undefined

    const targetState = DHD_WEBHOOK_EVENT_TO_STATE[payload.event]
    const from = shipment.order.state as never
    const canTransition = !!targetState && targetState !== shipment.order.state && isValidTransition(from, targetState as never)

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          courierStatus: payload.data.state.code,
          ...(driverName !== undefined ? { driverName } : {}),
          ...(driverPhone !== undefined ? { driverPhone } : {})
        }
      })
      if (canTransition) {
        await tx.order.update({ where: { id: shipment.orderId }, data: { state: targetState as never } })
      }
    })

    if (canTransition) {
      await this.audit.log({
        action: 'StateTransition',
        entity: 'Order',
        entityId: shipment.orderId,
        metadata: { from: shipment.order.state, to: targetState, source: 'dhd-webhook', event: payload.event, tracking: payload.data.tracking }
      })
      this.googleSheets.updateOrderStatus(shipment.orderId, shipment.order.state as never, targetState as never).catch((err: Error) => {
        this.logger.warn(`Google Sheets status update failed for order ${shipment.orderId}: ${err.message}`)
      })
    }

    return canTransition
  }
}
