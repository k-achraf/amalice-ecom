<script setup lang="ts">
import { ORDER_STATE_LABELS, type OrderState } from '@amalice/shared'

type Appearance = 'neutral' | 'blue' | 'green' | 'red' | 'yellow' | 'orange'

// Mapped onto the design's five order pills: new (warn), confirmed (ok),
// shipping (mist), delivered (teal), returned (danger).
const STATE: Record<OrderState, { appearance: Appearance; bold?: boolean }> = {
  PendingCallCenter: { appearance: 'yellow' },
  CallCenterNoAnswer: { appearance: 'orange' },
  WrongNumber: { appearance: 'red' },
  Postponed: { appearance: 'orange' },
  Cancelled: { appearance: 'red' },
  Confirmed: { appearance: 'green' },
  OnHold: { appearance: 'orange' },
  Packed: { appearance: 'blue' },
  HandedToCourier: { appearance: 'blue' },
  OutForDelivery: { appearance: 'blue' },
  DeliveryFailed: { appearance: 'red', bold: true },
  Delivered: { appearance: 'green', bold: true },
  ReturnedToOrigin: { appearance: 'red' },
  Restocked: { appearance: 'neutral' },
  CashCollected: { appearance: 'green', bold: true },
  Reconciled: { appearance: 'green', bold: true },
  Settled: { appearance: 'green', bold: true },
  CancelledShipping: { appearance: 'red' }
}

const props = defineProps<{ state: OrderState }>()
const meta = computed(() => STATE[props.state])
</script>

<template>
  <AdsLozenge :appearance="meta.appearance" :bold="meta.bold">{{ ORDER_STATE_LABELS[state] }}</AdsLozenge>
</template>
