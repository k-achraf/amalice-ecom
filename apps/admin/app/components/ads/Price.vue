<script setup lang="ts">
// Cents-based (integer), never floats, aligned with the Order schema in
// packages/shared. Displayed the design's way: "4,900 DA" (no symbol, decimals
// only when the amount has them).
const props = withDefaults(defineProps<{ amountCents: number; currency?: string }>(), { currency: 'DZD' })

const formatted = computed(() => {
  const n = (props.amountCents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${n} ${props.currency === 'DZD' ? 'DA' : props.currency}`
})
</script>

<template>
  <span class="ads-tabular">{{ formatted }}</span>
</template>
