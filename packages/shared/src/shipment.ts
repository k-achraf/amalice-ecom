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
