<script setup lang="ts">
// ADM-09 — Stripe-style KPI card: label, big tabular number, optional delta
// with up/down icon + semantic color, and a colored icon chip so the card
// reads as a deliberate visual unit rather than plain text in a box.
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; good?: 'up' | 'down' }
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
}>(), {
  color: 'primary'
})

const chipClass = computed(() => `admin-icon-chip admin-icon-chip-${props.color}`)
</script>

<template>
  <div class="admin-kpi-card is-interactive space-y-3 p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">{{ label }}</p>
      <span v-if="icon" :class="chipClass">
        <UIcon :name="icon" class="size-4" />
      </span>
    </div>
    <p class="tabular text-3xl font-semibold text-highlighted">{{ value }}</p>
    <div v-if="delta" class="flex items-center gap-1 text-xs">
      <UIcon
        v-if="delta.direction !== 'neutral'"
        :name="delta.direction === 'up' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
        :class="delta.direction === (delta.good ?? 'up') ? 'text-success' : 'text-error'"
      />
      <span :class="delta.direction === (delta.good ?? 'up') ? 'text-success' : 'text-error'">{{ delta.value }}</span>
    </div>
  </div>
</template>
