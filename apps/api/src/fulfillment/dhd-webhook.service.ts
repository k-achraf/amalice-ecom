import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'
import type { IncomingHttpHeaders } from 'http'
import { DHD_WEBHOOK_EVENT_TO_STATE, DhdWebhookPayloadSchema, isValidTransition, type DhdWebhookPayload } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../common/audit.service'
import { GoogleSheetsService } from '../apps/google-sheets.service'

// Body/headers captured on a CourierWebhookLog row are capped at this many
// characters — DHD's payloads are small JSON, this is purely a defensive
// bound against an adversarial or broken delivery bloating a row.
const RAW_LOG_MAX_CHARS = 20_000

// DHD's "state-webhooks" inbound handler — see fulfillment/webhooks.controller.ts
// for the route. Every event is logged to CourierWebhookEvent regardless of
// whether it ends up changing anything (audit trail + the idempotency
// mechanism DHD's own docs recommend: "use tracking + event as a dedup
// key" — the table's unique constraint on exactly that pair IS the dedup).
//
// Separately — and unconditionally, even for a request rejected before any
// of that — every single request is also written to CourierWebhookLog (see
// its Prisma model comment) via handle()'s try/finally below. That table
// exists specifically because CourierWebhookEvent can only ever hold a row
// for a request that made it all the way through signature verification and
// payload parsing, which left the admin's webhook log looking completely
// empty during a run of 401s/400s — there was nowhere for a failed attempt
// to be recorded.
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

  async handle(shippingCompanyId: string, rawBody: Buffer | undefined, signatureHeader: string | undefined, rawPayload: unknown, headers: IncomingHttpHeaders): Promise<{ received: true; applied: boolean }> {
    // Captured unconditionally in the outer try/finally below, regardless of
    // which branch this request ends up taking (or throwing out of).
    let signatureValid: boolean | null = null
    let statusCode = 200
    let errorMessage: string | null = null

    try {
      const company = await this.prisma.shippingCompany.findUnique({ where: { id: shippingCompanyId } })
      if (!company || company.provider !== 'Dhd') throw new NotFoundException('Unknown webhook endpoint')

      if (!company.webhookSecret) {
        throw new BadRequestException('This webhook has no secret configured yet — set one under Settings → Shipping Companies before enabling it in DHD.')
      }
      // The HMAC key is always this specific company's own saved secret —
      // never a global/env value, never apiToken — read fresh from the DB on
      // every request (no caching layer in front of it), so a secret saved
      // via Settings → Shipping Companies takes effect on the very next
      // delivery with no restart needed.
      //
      // A request with NO signature header at all is let through unverified
      // (logged, not rejected) — deliberately, at the account owner's request,
      // because DHD's real deliveries were observed NOT sending one (confirmed
      // via a manually HMAC-signed curl test that passed verification cleanly
      // against the saved secret, isolating the 401s to DHD's own delivery
      // path, not this code). This is a real security trade-off: anyone who
      // knows/guesses a valid :shippingCompanyId can POST unsigned state
      // updates once this branch is reached. If DHD's platform starts sending
      // the header (or a fix comes from their side), verification kicks back
      // in immediately below with zero further changes needed — a signature
      // that IS present is still verified normally, and a WRONG signature is
      // still rejected. Only a request with the header entirely absent skips
      // the check.
      if (!signatureHeader) {
        this.logger.warn(
          `DHD webhook: no "signature" header on this request for shipping company ${shippingCompanyId} — proceeding unverified (by design, see handle()'s comment). ` +
            `Headers actually received: ${Object.keys(headers).join(', ')}`
        )
      } else {
        // Split into distinct log lines rather than one generic "failed" —
        // "no rawBody at all" (a server/proxy problem: main.ts's rawBody:true
        // option didn't take effect, or something upstream is buffering/
        // re-encoding the body before Nest sees it) and "rawBody present but
        // doesn't hash to the header" (almost always a wrong/stale/whitespace-
        // damaged secret) need different fixes, and the response body
        // deliberately doesn't distinguish them (never help an attacker
        // fingerprint which check failed).
        if (!rawBody) {
          this.logger.warn(`DHD webhook: no raw body captured for shipping company ${shippingCompanyId} — check main.ts's rawBody:true option took effect (API rebuilt/restarted?) and that nothing upstream (reverse proxy) is altering the request body`)
          throw new UnauthorizedException('Invalid signature')
        }
        signatureValid = this.verifySignature(rawBody, signatureHeader, company.webhookSecret)
        if (!signatureValid) {
          const expected = 'sha256=' + crypto.createHmac('sha256', company.webhookSecret).update(rawBody).digest('hex')
          this.logger.warn(
            `DHD webhook: signature mismatch for shipping company ${shippingCompanyId} — ` +
              `received header "${signatureHeader.slice(0, 15)}…" (len ${signatureHeader.length}), ` +
              `expected "${expected.slice(0, 15)}…" (len ${expected.length}) from a ${rawBody.length}-byte body — ` +
              'check the saved webhook secret matches DHD\'s exactly (no extra whitespace from copy/paste)'
          )
          throw new UnauthorizedException('Invalid signature')
        }
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
    } catch (err) {
      statusCode = err instanceof HttpException ? err.getStatus() : 500
      errorMessage = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      // Unconditional — runs whether handle() returned normally or threw,
      // and never itself throws out of handle() (a logging failure must
      // never turn into a 500 for the actual webhook response).
      await this.prisma.courierWebhookLog
        .create({
          data: {
            shippingCompanyId,
            provider: 'Dhd',
            method: 'POST',
            path: `/webhooks/dhd/${shippingCompanyId}`,
            headers: headers as object,
            rawBody: rawBody ? rawBody.toString('utf8').slice(0, RAW_LOG_MAX_CHARS) : null,
            signatureHeader: signatureHeader ?? null,
            signatureValid,
            statusCode,
            errorMessage
          }
        })
        .catch((logErr: Error) => this.logger.error(`Failed to write CourierWebhookLog row: ${logErr.message}`))
    }
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
