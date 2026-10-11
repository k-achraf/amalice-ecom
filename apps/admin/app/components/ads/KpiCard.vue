<script setup lang="ts">
// KPI tile: label, big tabular number, optional delta, optional icon chip.
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; good?: 'up' | 'down' }
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'
}>(), { color: 'primary' })

const chip: Record<string, string> = {
  primary: 'bg-ads-selected text-ads-primary',
  info: 'bg-ads-selected text-ads-primary',
  success: 'bg-[#dcfff1] text-[#216e4e] dark:bg-[#1c3329] dark:text-[#7ee2b8]',
  warning: 'bg-[#fff7d6] text-[#7f5f01] dark:bg-[#3d2e00] dark:text-[#f5cd47]',
  error: 'bg-[#ffecee] text-[#ae2e24] dark:bg-[#42221f] dark:text-[#ff9c8f]',
  neutral: 'bg-ads-hover text-ads-subtle'
}
const good = computed(() => props.delta && props.delta.direction === (props.delta.good ?? 'up'))
</script>

<template>
  <div class="space-y-3 rounded-ads-lg border border-ads-border bg-ads-surface p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm text-ads-subtle">{{ label }}</p>
      <span v-if="icon" class="inline-flex size-8 items-center justify-center rounded-ads" :class="chip[color]"><AdsIcon :name="icon" class="size-4" /></span>
    </div>
    <p class="ads-tabular text-3xl font-semibold text-ads-text">{{ value }}</p>
    <div v-if="delta" class="flex items-center gap-1 text-xs" :class="good ? 'text-[#216e4e] dark:text-[#7ee2b8]' : 'text-ads-danger'">
      <AdsIcon v-if="delta.direction !== 'neutral'" :name="delta.direction === 'up' ? 'i-lucide-trending-up' : 'i-lucide-trending-down'" class="size-3.5" />
      <span>{{ delta.value }}</span>
    </div>
  </div>
</template>
