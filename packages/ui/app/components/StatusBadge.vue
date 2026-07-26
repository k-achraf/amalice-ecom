<script setup lang="ts">
export type OrderState =
  | 'PendingOTP'
  | 'Cancelled'
  | 'Confirmed'
  | 'Packed'
  | 'HandedToCourier'
  | 'OutForDelivery'
  | 'DeliveryFailed'
  | 'Delivered'
  | 'ReturnedToOrigin'
  | 'Restocked'
  | 'CashCollected'
  | 'Reconciled'
  | 'Settled'

type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'

const STATE_MAP: Record<OrderState, { color: StatusColor; icon: string; label: string }> = {
  PendingOTP: { color: 'warning', icon: 'i-lucide-clock', label: 'Awaiting verification' },
  Cancelled: { color: 'neutral', icon: 'i-lucide-x-circle', label: 'Cancelled' },
  Confirmed: { color: 'info', icon: 'i-lucide-check', label: 'Confirmed' },
  Packed: { color: 'info', icon: 'i-lucide-package', label: 'Packed' },
  HandedToCourier: { color: 'info', icon: 'i-lucide-truck', label: 'With courier' },
  OutForDelivery: { color: 'info', icon: 'i-lucide-truck', label: 'Out for delivery' },
  DeliveryFailed: { color: 'warning', icon: 'i-lucide-alert-triangle', label: 'Delivery attempt failed' },
  Delivered: { color: 'success', icon: 'i-lucide-check-circle', label: 'Delivered' },
  ReturnedToOrigin: { color: 'error', icon: 'i-lucide-rotate-ccw', label: 'Returned to origin' },
  Restocked: { color: 'neutral', icon: 'i-lucide-package-check', label: 'Restocked' },
  CashCollected: { color: 'success', icon: 'i-lucide-banknote', label: 'Cash collected' },
  Reconciled: { color: 'success', icon: 'i-lucide-check-circle', label: 'Reconciled' },
  Settled: { color: 'success', icon: 'i-lucide-badge-check', label: 'Settled' }
}

const props = defineProps<{ state: OrderState }>()
const meta = computed(() => STATE_MAP[props.state])
</script>

<template>
  <UBadge :color="meta.color" variant="subtle" :icon="meta.icon">
    {{ meta.label }}
  </UBadge>
</template>
