import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  CourierProvider,
  CourierWebhookPayload,
  CreateShipmentInput,
  NormalizedCourierStatus,
  ShipmentResult
} from './courier-provider.interface'

// COU-01 — the mock/fake courier provider for local dev and tests. No real
// API calls; createShipment synthesizes a deterministic tracking reference,
// getStatus reads from an in-memory map, parseWebhook accepts a normalized
// shape. A real adapter (COU-02) replaces this binding with one that hits a
// real courier sandbox — same interface, real HTTP.
//
// Status transitions are driven manually in dev (via the admin fulfillment
// screen ADM-13 calling markStatus) rather than by an external webhook, since
// there's no real courier to send one. This is the documented mock: swap the
// COURIER_PROVIDER binding in fulfillment.module.ts to go real.
@Injectable()
export class MockCourierProvider implements CourierProvider {
  private readonly logger = new Logger(MockCourierProvider.name)
  // In-memory shipment state keyed by tracking reference. Fine for dev — this
  // is per-process and resets on restart, which is exactly what local dev wants.
  private readonly shipments = new Map<string, NormalizedCourierStatus>()

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const trackingReference = `MOCK-${input.orderId.slice(0, 8).toUpperCase()}-${Date.now().toString(36)}`
    this.shipments.set(trackingReference, 'created')
    this.logger.log(
      `[MOCK COURIER] Shipment created: ${trackingReference} → ${input.recipientPhone}, ` +
        `COD ${(input.codAmountCents / 100).toFixed(2)} DZD, ${input.address.city}/${input.address.region}`
    )
    return { trackingReference, courierStatus: 'created' }
  }

  async getStatus(trackingReference: string) {
    const status = this.shipments.get(trackingReference)
    if (!status) throw new NotFoundException(`Unknown tracking reference: ${trackingReference}`)
    return { normalizedStatus: status, courierStatus: status }
  }

  async cancelShipment(trackingReference: string) {
    if (!this.shipments.has(trackingReference)) {
      throw new NotFoundException(`Unknown tracking reference: ${trackingReference}`)
    }
    this.shipments.set(trackingReference, 'cancelled')
    this.logger.log(`[MOCK COURIER] Shipment cancelled: ${trackingReference}`)
  }

  // Dev-only: the admin fulfillment screen (ADM-13) drives mock status
  // changes through here, simulating what a real courier's webhook would do.
  // NOT part of the CourierProvider interface — it's test/dev scaffolding.
  markStatus(trackingReference: string, status: NormalizedCourierStatus) {
    if (!this.shipments.has(trackingReference)) {
      throw new NotFoundException(`Unknown tracking reference: ${trackingReference}`)
    }
    this.shipments.set(trackingReference, status)
    this.logger.log(`[MOCK COURIER] Status update: ${trackingReference} → ${status}`)
  }

  parseWebhook(rawBody: unknown): CourierWebhookPayload {
    // Mock webhooks are already-normalized: { trackingReference, normalizedStatus }.
    // A real adapter's parseWebhook would map provider-specific codes here.
    const body = rawBody as { trackingReference?: string; normalizedStatus?: NormalizedCourierStatus }
    if (!body.trackingReference || !body.normalizedStatus) {
      throw new Error('Mock webhook requires trackingReference and normalizedStatus')
    }
    return { trackingReference: body.trackingReference, normalizedStatus: body.normalizedStatus, raw: body }
  }
}
