import { z } from 'zod'
import type { OrderState } from './order'

// DHD's "state-webhooks" payload shape — see their docs. `reference`/`driver`
// fields can be empty strings (no driver assigned yet) but are always
// present as keys; `driver` itself is the only genuinely optional object
// (older/edge-case events may omit it entirely).
export const DhdWebhookPayloadSchema = z.object({
  event: z.string(),
  timestamp: z.string(),
  data: z.object({
    tracking: z.string().min(1),
    reference: z.string().optional().default(''),
    state: z.object({
      id: z.number(),
      code: z.string(),
      title: z.string(),
      title_en: z.string()
    }),
    driver: z
      .object({
        name: z.string().optional().default(''),
        phone: z.string().optional().default('')
      })
      .optional(),
    changed_at: z.string()
  })
})
export type DhdWebhookPayload = z.infer<typeof DhdWebhookPayloadSchema>

// DHD's 21 webhook events → our OrderState machine. Keyed by `event` (the
// `order.{action}` string), not the numeric state id — the id is DHD's
// internal identifier for the ID list you pick from when configuring which
// states trigger the webhook, not a stable cross-reference for us to key
// application logic off.
//
// null means "record the event (and any driver info) but don't attempt an
// order-state transition" — DHD's pipeline has finer-grained sub-states
// (multiple hub-transit steps, several distinct "returning" stages) than
// our OrderState machine models; forcing each one onto a specific state
// would either be a guess or a no-op most of the time anyway. Every mapped
// target still goes through isValidTransition before being applied (see
// FulfillmentService/DhdWebhookService), so a wrong guess here fails safe
// (transition simply skipped + logged) rather than corrupting order state.
export const DHD_WEBHOOK_EVENT_TO_STATE: Record<string, OrderState | null> = {
  'order.ready_to_ship': null,
  'order.ready_to_prepare': null,
  'order.collecting': 'HandedToCourier',
  'order.preparing_in_stock': 'HandedToCourier',
  'order.shipping_to_hub': 'HandedToCourier',
  'order.in_hub': 'HandedToCourier',
  'order.shipping_to_wilaya': 'HandedToCourier',
  'order.preparing_for_delivery': 'HandedToCourier',
  'order.delivering': 'OutForDelivery',
  'order.suspended': 'DeliveryFailed',
  'order.returning_to_dispatcher': 'ReturnedToOrigin',
  'order.returning_to_driver': 'ReturnedToOrigin',
  'order.returning_to_sender': 'ReturnedToOrigin',
  'order.returned_to_sender': 'ReturnedToOrigin',
  'order.returning_to_warehouse_transit': 'ReturnedToOrigin',
  'order.returning_to_warehouse': 'ReturnedToOrigin',
  'order.returned_to_warehouse': 'ReturnedToOrigin',
  'order.delivered_cod_pending': 'Delivered',
  'order.delivered_cod_not_paid': 'Delivered',
  'order.payment_ready': 'CashCollected',
  'order.returned_archived': 'Restocked',
  'order.payment_archived': 'Settled'
}
