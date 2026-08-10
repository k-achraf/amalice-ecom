<script setup lang="ts">
import { ORDER_STATE_LABELS, type OrderState } from '@amalice/shared'

// Every state gets its own hue (not just the 5 Nuxt UI semantic colors,
// which collided badly — e.g. Confirmed/Packed/HandedToCourier/OutForDelivery
// all read as identical "info" blue) so a status is recognizable by color
// alone across the order list, call-center/fulfillment/shipping queues, and
// order detail. Colors are grouped loosely by pipeline stage (see
// ORDER_STAGE_BY_STATE) but every individual state is a distinct Tailwind
// hue — 17 states, 17 hues, zero repeats. Labels come from the shared
// ORDER_STATE_LABELS map (packages/shared/src/order.ts) — also what the
// Google Sheets integration writes server-side — so this UI and that sheet
// column never drift apart.
// Hue assignment is the single source of truth this component and
// ORDER_STATE_SHEET_COLORS (packages/shared/src/order.ts) both derive
// from — keep them in sync by hand if either changes. Deliberate anchors:
// Confirmed = green, Delivered = a DIFFERENT green (emerald) — both "success"
// but visually distinct from each other; Cancelled and ReturnedToOrigin both
// sit in the red family (red / rose) as the two clearly-negative outcomes,
// again using different exact hues so neither collides with the other.
// (CancelledShipping — the post-confirmation cancel — gets its own hue
// entirely rather than joining the red family, on the same "never collide"
// principle.)
const STATE_MAP: Record<OrderState, { hue: string; icon: string }> = {
  PendingCallCenter: { hue: 'amber', icon: 'i-lucide-phone-call' },
  CallCenterNoAnswer: { hue: 'orange', icon: 'i-lucide-phone-missed' },
  WrongNumber: { hue: 'fuchsia', icon: 'i-lucide-phone-off' },
  Postponed: { hue: 'yellow', icon: 'i-lucide-calendar-clock' },
  Cancelled: { hue: 'red', icon: 'i-lucide-x-circle' },
  Confirmed: { hue: 'green', icon: 'i-lucide-check' },
  OnHold: { hue: 'violet', icon: 'i-lucide-pause-circle' },
  Packed: { hue: 'blue', icon: 'i-lucide-package' },
  HandedToCourier: { hue: 'indigo', icon: 'i-lucide-truck' },
  OutForDelivery: { hue: 'sky', icon: 'i-lucide-truck' },
  DeliveryFailed: { hue: 'pink', icon: 'i-lucide-alert-triangle' },
  Delivered: { hue: 'emerald', icon: 'i-lucide-check-circle' },
  ReturnedToOrigin: { hue: 'rose', icon: 'i-lucide-rotate-ccw' },
  Restocked: { hue: 'slate', icon: 'i-lucide-package-check' },
  CashCollected: { hue: 'lime', icon: 'i-lucide-banknote' },
  Reconciled: { hue: 'teal', icon: 'i-lucide-check-circle' },
  Settled: { hue: 'cyan', icon: 'i-lucide-badge-check' },
  // A post-confirmation cancel (see OrderState's Prisma comment) — its own
  // hue so it reads as visually distinct from the pre-confirmation Cancelled
  // above, even though both are "cancelled".
  CancelledShipping: { hue: 'purple', icon: 'i-lucide-x-circle' }
}

// Tailwind can't see dynamically-built class strings at build time, so every
// hue's class combination must appear as a literal somewhere for the JIT
// scanner to pick it up — this map (rather than string interpolation) is
// that literal list.
const HUE_CLASSES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-400 dark:ring-amber-400/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-400 dark:ring-orange-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
  yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-400 dark:ring-yellow-400/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-400 dark:ring-sky-400/20',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-400 dark:ring-fuchsia-400/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-400 dark:ring-violet-400/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-400 dark:ring-rose-400/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  pink: 'bg-pink-50 text-pink-700 ring-pink-600/20 dark:bg-pink-400/10 dark:text-pink-400 dark:ring-pink-400/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-600/20 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20',
  green: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/20',
  lime: 'bg-lime-50 text-lime-700 ring-lime-600/20 dark:bg-lime-400/10 dark:text-lime-400 dark:ring-lime-400/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-400/10 dark:text-teal-400 dark:ring-teal-400/20',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-400/10 dark:text-cyan-400 dark:ring-cyan-400/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/20'
}

const props = defineProps<{ state: OrderState }>()
const meta = computed(() => STATE_MAP[props.state])
const classes = computed(() => HUE_CLASSES[meta.value.hue])
const label = computed(() => ORDER_STATE_LABELS[props.state])
</script>

<template>
  <span :class="classes" class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset">
    <Icon :name="meta.icon" class="size-3" />
    {{ label }}
  </span>
</template>
