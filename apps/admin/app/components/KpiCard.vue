<script setup lang="ts">
// ADM-09 — Stripe-style KPI card: label, big tabular number, optional delta
// with up/down icon + semantic color. Uses the admin shadow/radius tokens.
defineProps<{
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; good?: 'up' | 'down' }
  icon?: string
}>()
</script>

<template>
  <div class="admin-kpi-card space-y-2 p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">{{ label }}</p>
      <UIcon v-if="icon" :name="icon" class="size-4 text-muted" />
    </div>
    <p class="tabular text-2xl font-semibold text-highlighted">{{ value }}</p>
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
