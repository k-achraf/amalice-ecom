import { z } from 'zod'
import { courierStatusToOrderState } from './shipment'

// ---- Delivery details: every order sent to a shipping company ----

export const DELIVERY_STAGES = ['all', 'awaiting', 'withCourier', 'out', 'failed', 'delivered', 'returned'] as const
export const DeliveryStageSchema = z.enum(DELIVERY_STAGES)
export type DeliveryStage = z.infer<typeof DeliveryStageSchema>

export const DELIVERY_STAGE_LABELS: Record<DeliveryStage, string> = {
  all: 'All',
  awaiting: 'Awaiting confirmation',
  withCourier: 'With the courier',
  out: 'Out for delivery',
  failed: 'Delivery failed',
  delivered: 'Delivered',
  returned: 'Returned / cancelled'
}

export interface DeliveryRemark {
  at: string
  // 'attempt' = a delivery-attempt entry, 'remark' = a remark written by the driver or by us
  kind: 'attempt' | 'remark'
  text: string
  by: string | null
  station: string | null
}

export interface DeliveryListItem {
  shipmentId: string
  orderId: string
  orderState: string
  orderCreatedAt: string
  dispatchedAt: string
  codCents: number
  shippingType: 'Home' | 'Desk' | null
  customer: { name: string | null; phone: string }
  address: { region: string; city: string; line1: string }
  items: { name: string; quantity: number; variantLabel: string | null; imageUrl: string | null }[]
  courier: { name: string; companyId: string | null }
  // 'api' = created through the courier's API, 'manual' = recorded by hand / own driver.
  via: 'api' | 'manual'
  trackingReference: string | null
  courierStatusCode: string | null
  courierStatusLabel: string | null
  confirmed: boolean
  confirmedAt: string | null
  driverName: string | null
  driverPhone: string | null
  desk: { phone: string | null; commune: string | null; address: string | null; mapLink: string | null } | null
  lastFailureReason: string | null
  postponedTo: string | null
  carrierFeeCents: number | null
  returnFeeCents: number | null
  lastSyncedAt: string | null
  // Newest first, at most 5.
  remarks: DeliveryRemark[]
  // The courier's full delivery history for the parcel (get/trackings/info), newest first.
  history: DeliveryHistoryEntry[]
  source: DeliveryLiveInfo
}

export interface DeliveryListResponse {
  items: DeliveryListItem[]
  total: number
  page: number
  pageSize: number
  counts: Record<DeliveryStage, number>
  // When the courier data was read, and which couriers could not be reached.
  fetchedAt: string
  liveErrors: { company: string; message: string }[]
}

// The stage tab a courier status belongs to (null = unknown status).
export function deliveryStageOfCourierStatus(raw: string): Exclude<DeliveryStage, 'all'> | null {
  const mapped = courierStatusToOrderState(raw)
  if (mapped === undefined) return null
  return deliveryStageOfOrderState(mapped)
}

// Same grouping from our own order state, for parcels the courier can't be asked about.
export function deliveryStageOfOrderState(state: string | null): Exclude<DeliveryStage, 'all'> {
  switch (state) {
    case null: return 'awaiting'
    case 'OutForDelivery': return 'out'
    case 'DeliveryFailed': return 'failed'
    case 'Delivered': case 'CashCollected': case 'Reconciled': case 'Settled': return 'delivered'
    case 'ReturnedToOrigin': case 'Restocked': case 'CancelledShipping': return 'returned'
    default: return 'withCourier'
  }
}

// The courier's status codes that make up each stage (for its status filter).
export const COURIER_CODES_BY_STAGE: Record<Exclude<DeliveryStage, 'all'>, string[]> = {
  awaiting: ['prete_a_expedier'],
  withCourier: ['en_ramassage', 'en_preparation_stock', 'vers_hub', 'en_hub', 'vers_wilaya', 'en_preparation'],
  out: ['en_livraison'],
  failed: ['suspendu'],
  delivered: ['livre_non_encaisse', 'encaisse_non_paye', 'paiements_prets', 'paye_et_archive'],
  returned: ['retour_chez_livreur', 'retour_transit_entrepot', 'retour_en_traitement', 'retour_recu', 'retour_archive', 'annule']
}

export interface DeliveryHistoryEntry {
  at: string | null
  reason: string | null
  details: string | null
  station: string | null
  driver: string | null
  postponedTo: string | null
}

export interface DeliveryLiveInfo {
  // true: this card's courier fields were just read from the courier's API.
  live: boolean
  // Why the live read failed (the card then shows what we last stored).
  error: string | null
}
