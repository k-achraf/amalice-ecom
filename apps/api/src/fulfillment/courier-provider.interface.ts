// COU-01 — the contract every courier integration implements. This is the
// seam that keeps "add a second courier" from being a rewrite of the order
// module: a new courier is a new adapter + one binding change, nothing else.
//
// The mock adapter (MockCourierProvider) implements this for local dev and
// tests — no real API calls. A real adapter (COU-02) implements the same
// interface against a real courier's sandbox API.

export interface CreateShipmentInput {
  orderId: string
  // The customer's shipping address, normalized — adapters map to the
  // courier's own field names.
  address: {
    line1: string
    line2?: string | null
    city: string
    region: string
    postalCode: string
    country: string
  }
  recipientName: string | null
  recipientPhone: string
  // Total COD amount to collect on delivery, in cents. The courier collects
  // this from the customer; reconciliation (FIN) matches it back.
  codAmountCents: number
  weightGrams?: number
  notes?: string
  // Home vs. desk/relay pickup — maps 1:1 from Order.shippingType. Optional
  // since the mock provider ignores it; a real adapter that distinguishes
  // the two (DHD does: stop_desk) reads it.
  stopDesk?: boolean
  // Line items, for adapters that pass a human-readable product manifest to
  // the courier (DHD's produit/quantite fields) — descriptive only, never
  // used for pricing (codAmountCents is authoritative).
  items?: { name: string; quantity: number }[]
}

export interface ShipmentResult {
  // The courier's tracking/reference ID — stored against the Shipment and
  // used as the reconciliation join key (FIN-03).
  trackingReference: string
  // The courier's own status label (provider-specific). Normalized to the
  // internal order state by parseWebhook / getStatus.
  courierStatus: string
}

// Normalized internal states — every adapter maps its provider-specific codes
// to one of these, so the rest of the app never sees raw provider strings.
// These map onto the order lifecycle (plan §7): the webhook handler moves
// the order along its state machine using these.
export type NormalizedCourierStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned'
  | 'cancelled'

export interface CourierWebhookPayload {
  trackingReference: string
  normalizedStatus: NormalizedCourierStatus
  // Raw provider payload, for the audit trail / debugging.
  raw?: unknown
}

export const COURIER_PROVIDER = Symbol('COURIER_PROVIDER')

export interface CourierProvider {
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>
  getStatus(trackingReference: string): Promise<{ normalizedStatus: NormalizedCourierStatus; courierStatus: string }>
  cancelShipment(trackingReference: string): Promise<void>
  // Normalizes a raw provider webhook body into the internal status enum.
  // The webhook controller authenticates the request FIRST, then calls this.
  parseWebhook(rawBody: unknown): CourierWebhookPayload
}
