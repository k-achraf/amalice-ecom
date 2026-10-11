<script setup lang="ts">
import { ORDER_STATE_LABELS, type OrderState } from '@amalice/shared'

type Appearance = 'neutral' | 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'teal' | 'magenta' | 'lime'

// Atlassian lozenges are semantic, not one-hue-per-state: the colour tells you
// the stage (waiting / in motion / done / problem), the label tells you which.
const STATE: Record<OrderState, { appearance: Appearance; bold?: boolean }> = {
  PendingCallCenter: { appearance: 'yellow' },
  CallCenterNoAnswer: { appearance: 'orange' },
  WrongNumber: { appearance: 'magenta' },
  Postponed: { appearance: 'purple' },
  Cancelled: { appearance: 'red' },
  Confirmed: { appearance: 'blue' },
  OnHold: { appearance: 'neutral' },
  Packed: { appearance: 'teal' },
  HandedToCourier: { appearance: 'teal', bold: true },
  OutForDelivery: { appearance: 'blue', bold: true },
  DeliveryFailed: { appearance: 'red', bold: true },
  Delivered: { appearance: 'green' },
  ReturnedToOrigin: { appearance: 'orange', bold: true },
  Restocked: { appearance: 'neutral' },
  CashCollected: { appearance: 'lime' },
  Reconciled: { appearance: 'green' },
  Settled: { appearance: 'green', bold: true },
  CancelledShipping: { appearance: 'red', bold: true }
}

const props = defineProps<{ state: OrderState }>()
const meta = computed(() => STATE[props.state])
</script>

<template>
  <AdsLozenge :appearance="meta.appearance" :bold="meta.bold">{{ ORDER_STATE_LABELS[state] }}</AdsLozenge>
</template>
