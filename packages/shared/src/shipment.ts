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
  orderIds: z.array(z.uuid()).min(1)
})
export type BulkDispatch = z.infer<typeof BulkDispatchSchema>

export const ValidateOrderReturnsSchema = z.object({
  orderIds: z.array(z.uuid()).min(1)
})
export type ValidateOrderReturns = z.infer<typeof ValidateOrderReturnsSchema>
