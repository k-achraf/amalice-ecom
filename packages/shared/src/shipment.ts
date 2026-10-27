import { z } from 'zod'

export const ShipmentSchema = z.object({
  id: z.uuid().optional(),
  orderId: z.uuid(),
  courierId: z.uuid(),
  trackingReference: z.string().min(1).max(200).optional(),
  // Raw courier-specific status string — normalized into OrderState by the
  // CourierProvider adapter (plan §9), not validated against OrderState
  // here since couriers don't speak our enum.
  courierStatus: z.string().min(1).max(100).optional()
})
export type Shipment = z.infer<typeof ShipmentSchema>

// How an order is being shipped, assigned explicitly per order before
// dispatch is possible — never auto-resolved from a "default" shipping
// company. Unassigned is every order's starting state on reaching
// fulfillment; ShippingCompany requires shippingCompanyId set (assignCompany);
// Manual means the shop's own delivery person handles it, with no shipping
// company/courier API involved at all (assignManual + dispatchManual).
export const FulfillmentMethodSchema = z.enum(['Unassigned', 'ShippingCompany', 'Manual'])
export type FulfillmentMethod = z.infer<typeof FulfillmentMethodSchema>

export const AssignShippingCompanySchema = z.object({
  shippingCompanyId: z.uuid()
})
export type AssignShippingCompany = z.infer<typeof AssignShippingCompanySchema>

// Manual dispatch — records a shipment without calling any shipping
// company's API (see FulfillmentService.dispatchManual for the two cases
// this covers: true manual/in-house delivery, or an order already assigned
// to a shipping company that staff arranged directly with that company
// instead of through our API integration). No API call means no
// automatically-generated tracking number, so the admin types one in.
export const DispatchManualSchema = z.object({
  // Optional: the courier's tracking number if the shipment was created by
  // hand on the courier's own platform and the number is known. Without one the
  // order is still recorded as sent, but courier webhooks can't match it, so
  // later statuses must be advanced manually.
  trackingReference: z.string().trim().max(200).optional()
})
export type DispatchManual = z.infer<typeof DispatchManualSchema>

// The rest of the "Commandes" section actions beyond create (dispatch) —
// see FulfillmentService's requestPickup/cancelShipmentForOrder/
// updateShipmentForOrder/bulkDispatch/validateReturns.
export const RequestPickupSchema = z.object({
  // Whether to ask DHD to collect the parcel from the shop, vs. the shop
  // dropping it off itself — see DhdApiService.shipOrder's comment.
  askCollection: z.boolean().default(true)
})
export type RequestPickup = z.infer<typeof RequestPickupSchema>

export const UpdateShipmentSchema = z.object({
  nom_client: z.string().max(255).optional(),
  telephone: z.string().max(20).optional(),
  telephone_2: z.string().max(20).optional(),
  adresse: z.string().max(255).optional(),
  commune: z.string().max(255).optional(),
  // Whole DZD, as a string — matches DhdOrderPayload's own convention.
  montant: z.string().optional(),
  remarque: z.string().max(255).optional(),
  stop_desk: z.enum(['0', '1']).optional(),
  fragile: z.enum(['0', '1']).optional()
})
export type UpdateShipment = z.infer<typeof UpdateShipmentSchema>

export const BulkDispatchSchema = z.object({
  orderIds: z.array(z.uuid()).min(1),
  // Every order in the batch must already be individually assigned to this
  // same company (FulfillmentService.assignShippingCompany) — bulk-dispatch
  // never picks a company on the caller's behalf.
  shippingCompanyId: z.uuid(),
  // Never confirmed automatically: parcels stay "Prêt à expédier" until confirmed by hand.
  confirm: z.boolean().default(false),
  askCollection: z.boolean().default(true)
})
export type BulkDispatch = z.infer<typeof BulkDispatchSchema>

export const BulkLabelsSchema = z.object({
  orderIds: z.array(z.uuid()).min(1).max(200)
})
export type BulkLabels = z.infer<typeof BulkLabelsSchema>

export const ValidateOrderReturnsSchema = z.object({
  orderIds: z.array(z.uuid()).min(1)
})
export type ValidateOrderReturns = z.infer<typeof ValidateOrderReturnsSchema>

// ---- Courier sync (all Ecotrack-based shipping companies) ----

// Send an order to its shipping company. `confirm` also performs the courier's
// "Expedier" step right away (after which the parcel can no longer be edited or
// deleted at the courier); with confirm=false the parcel is only created and
// waits for an explicit confirmation.
export const DispatchOrderSchema = z.object({
  // Off by default and NEVER turned on by the system: the parcel stays "Prêt à expédier"
  // at the courier until someone confirms it by hand.
  confirm: z.boolean().default(false),
  // Ask the courier to pick the parcel up from the shop (vs. shop drop-off).
  askCollection: z.boolean().default(true)
})
export type DispatchOrder = z.infer<typeof DispatchOrderSchema>

// What goes to the courier besides the address: the remark/instructions, the
// fragile flag, the customer's GPS link, and the operation type. Editable until
// a shipment exists for the order.
export const UpdateDeliveryInfoSchema = z.object({
  deliveryNote: z.string().trim().max(255).nullable().optional(),
  isFragile: z.boolean().optional(),
  gpsLink: z.string().trim().max(500).nullable().optional(),
  courierOperation: z.enum(['Delivery', 'Exchange']).optional(),
  exchangeProduct: z.string().trim().max(255).nullable().optional()
})
export type UpdateDeliveryInfo = z.infer<typeof UpdateDeliveryInfoSchema>

// A remark for the delivery company ("call before 17:00").
export const CourierNoteSchema = z.object({
  content: z.string().trim().min(1).max(255)
})
export type CourierNote = z.infer<typeof CourierNoteSchema>

// The courier's own status codes (get/orders, get/orders/status, trackings
// info) mapped onto our order lifecycle. null = the parcel exists at the
// courier but hasn't been confirmed/collected yet.
export const COURIER_STATUS_TO_ORDER_STATE: Record<string, string | null> = {
  prete_a_expedier: null,
  pret_a_expedier: null,
  prete_a_preparer: null,
  pret_a_preparer: null,
  en_ramassage: 'HandedToCourier',
  en_preparation_stock: 'HandedToCourier',
  stock_en_preparation: 'HandedToCourier',
  vers_hub: 'HandedToCourier',
  en_hub: 'HandedToCourier',
  vers_wilaya: 'HandedToCourier',
  en_preparation: 'HandedToCourier',
  en_livraison: 'OutForDelivery',
  suspendu: 'DeliveryFailed',
  suspendus: 'DeliveryFailed',
  livre_non_encaisse: 'Delivered',
  encaisse_non_paye: 'Delivered',
  livre_encaisse_non_paye: 'Delivered',
  paiements_prets: 'CashCollected',
  paiement_pret: 'CashCollected',
  paye_et_archive: 'Settled',
  paiement_archive: 'Settled',
  retour_chez_livreur: 'ReturnedToOrigin',
  retours_chez_livreur: 'ReturnedToOrigin',
  retour_transit_entrepot: 'ReturnedToOrigin',
  retours_en_transit_stock: 'ReturnedToOrigin',
  retour_en_traitement: 'ReturnedToOrigin',
  retours_en_traitement: 'ReturnedToOrigin',
  retours_prets: 'ReturnedToOrigin',
  retour_recu: 'ReturnedToOrigin',
  retours_recu: 'ReturnedToOrigin',
  retours_a_dispatcher_vers_stock: 'ReturnedToOrigin',
  retours_en_stock: 'ReturnedToOrigin',
  retour_archive: 'Restocked',
  retours_archive: 'Restocked',
  annule: 'CancelledShipping'
}

// "Payé et archivé" / "Prêt à expédier" / "paye_et_archive" → one lookup key.
export function normalizeCourierStatus(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// undefined = status we don't know; null = known but doesn't advance the order.
export function courierStatusToOrderState(raw: string): string | null | undefined {
  const key = normalizeCourierStatus(raw)
  return key in COURIER_STATUS_TO_ORDER_STATE ? COURIER_STATUS_TO_ORDER_STATE[key] : undefined
}

export interface CourierActivityView {
  reason: string | null
  details: string | null
  station: string | null
  driver: string | null
  at: string | null
  postponedTo: string | null
}

export interface CourierUpdateView {
  remark: string
  station: string | null
  driver: string | null
  at: string | null
}

// Live view of a parcel at the courier, for the order page.
export interface ShipmentTrackingView {
  trackingReference: string | null
  courierStatus: string | null
  confirmed: boolean
  driverName: string | null
  driverPhone: string | null
  lastFailureReason: string | null
  postponedTo: string | null
  desk: { phone: string | null; commune: string | null; address: string | null; mapLink: string | null } | null
  carrierFeeCents: number | null
  returnFeeCents: number | null
  lastSyncedAt: string | null
  activity: CourierActivityView[]
  updates: CourierUpdateView[]
}

// Pre-dispatch check of an order's address against the courier's own list.
export interface AddressCheckResult {
  shippingCompanyId: string | null
  shippingCompanyName: string | null
  // false when there is no linked company / its locations were never synced.
  checked: boolean
  ok: boolean
  issues: string[]
  // The courier's spelling of the order's commune, when we could match it.
  matchedCommune: string | null
  postalCode: string | null
  stopDeskAvailable: boolean | null
  // Nearest valid commune names in that wilaya, offered when the name doesn't match.
  suggestions: string[]
}
