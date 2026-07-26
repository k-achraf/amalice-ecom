import type { OrderState } from '@amalice/shared'

// ADM-05 — the order lifecycle state machine, mirrored from the API's
// common/order-transitions.ts (the API is the source of truth). Used by the
// admin UI to make illegal transitions impossible to SUBMIT (client-side
// gating is UX only; the server re-validates — plan §ADM-02). Kept in sync
// by hand with the API copy; both must match cod-platform-plan.md §7.
export const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  PendingOTP: ['Confirmed', 'Cancelled'],
  Cancelled: [],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['HandedToCourier'],
  HandedToCourier: ['OutForDelivery'],
  OutForDelivery: ['Delivered', 'DeliveryFailed'],
  DeliveryFailed: ['OutForDelivery', 'ReturnedToOrigin'],
  Delivered: ['CashCollected'],
  ReturnedToOrigin: ['Restocked'],
  Restocked: [],
  CashCollected: ['Reconciled'],
  Reconciled: ['Settled'],
  Settled: []
}
