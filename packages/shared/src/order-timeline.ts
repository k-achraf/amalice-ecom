import { normalizeCourierStatus } from './shipment'

// ---- Order tracking: one unified, chronological record of everything that
// happened to an order — placement, status changes, calls, edits, our shipping
// actions, the courier's own history, money movements and notifications. ----

export const TIMELINE_CATEGORIES = ['order', 'call', 'edit', 'shipping', 'courier', 'finance', 'notification'] as const
export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number]

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  order: 'Status',
  call: 'Calls',
  edit: 'Edits',
  shipping: 'Shipping',
  courier: 'Courier',
  finance: 'Finance',
  notification: 'Messages'
}

export type TimelineTone = 'neutral' | 'good' | 'warn' | 'bad'

export interface OrderTimelineEvent {
  id: string
  at: string
  category: TimelineCategory
  tone: TimelineTone
  title: string
  detail: string | null
  // Who did it: an admin email, or "Customer", "Courier", "Google Sheets", "System".
  actor: string
  // Present in the global activity feed, where events from many orders are mixed.
  orderId?: string
}

export interface OrderMilestones {
  placedAt: string
  firstCallAt: string | null
  confirmedAt: string | null
  packedAt: string | null
  shippedAt: string | null
  outForDeliveryAt: string | null
  deliveredAt: string | null
  returnedAt: string | null
  cancelledAt: string | null
  cashCollectedAt: string | null
  settledAt: string | null
}

export interface OrderTimelineResponse {
  orderId: string
  state: string
  trackingReference: string | null
  courierName: string | null
  courierStatus: string | null
  totalCalls: number
  actors: string[]
  milestones: OrderMilestones
  // Minutes between consecutive milestones, null when either end hasn't happened.
  durations: { toFirstCall: number | null; toConfirm: number | null; confirmToShip: number | null; shipToDelivery: number | null; total: number | null }
  events: OrderTimelineEvent[]
}

export interface ActivityFeedResponse {
  events: OrderTimelineEvent[]
  // Pass as `before` to load the next (older) page; null when there is no more.
  nextBefore: string | null
}

// Courier status codes → readable labels (the courier's French codes).
export const COURIER_STATUS_LABELS: Record<string, string> = {
  prete_a_expedier: 'Ready to ship',
  pret_a_expedier: 'Ready to ship',
  prete_a_preparer: 'Ready to prepare',
  pret_a_preparer: 'Ready to prepare',
  en_ramassage: 'Being collected',
  en_preparation_stock: 'Preparing from stock',
  stock_en_preparation: 'Preparing from stock',
  vers_hub: 'Heading to hub',
  en_hub: 'At the hub',
  vers_wilaya: 'Heading to destination wilaya',
  en_preparation: 'Preparing for delivery',
  en_livraison: 'Out for delivery',
  suspendu: 'Suspended',
  suspendus: 'Suspended',
  livre_non_encaisse: 'Delivered — cash not collected',
  encaisse_non_paye: 'Cash collected — not paid out',
  livre_encaisse_non_paye: 'Cash collected — not paid out',
  paiements_prets: 'Payment ready',
  paiement_pret: 'Payment ready',
  paye_et_archive: 'Paid and archived',
  paiement_archive: 'Paid and archived',
  retour_chez_livreur: 'Return with the driver',
  retours_chez_livreur: 'Return with the driver',
  retour_transit_entrepot: 'Return in transit to warehouse',
  retours_en_transit_stock: 'Return in transit to warehouse',
  retour_en_traitement: 'Return being processed',
  retours_en_traitement: 'Return being processed',
  retours_prets: 'Return ready',
  retour_recu: 'Return received',
  retours_recu: 'Return received',
  retours_a_dispatcher_vers_stock: 'Return to be dispatched to stock',
  retours_en_stock: 'Return in stock',
  retour_archive: 'Return archived',
  retours_archive: 'Return archived',
  annule: 'Cancelled'
}

export function courierStatusLabel(raw: string): string {
  return COURIER_STATUS_LABELS[normalizeCourierStatus(raw)] ?? raw
}
