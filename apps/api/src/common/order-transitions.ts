import type { OrderState } from '@amalice/shared'

// The order lifecycle state machine from cod-platform-plan.md §7 — the single
// source of truth for which transitions are legal. ADM-05's manual override
// uses this to make an illegal transition impossible to SUBMIT (UI-level),
// not just reject it server-side. The admin service re-validates here too —
// client-side gating is UX only, never the actual guard (plan §ADM-02).
//
// Keeping this in common (not in the orders module) so both the public order
// flow and the admin flow consult the same map — one code path for "admin
// changed it" and "courier told us," not two divergent ones (COU-04's rule).
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

export function isValidTransition(from: OrderState, to: OrderState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
