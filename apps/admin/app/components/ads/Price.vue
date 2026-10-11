<script setup lang="ts">
// Cents-based (integer), never floats — avoids float rounding bugs in money
// math; aligned with the Order schema in packages/shared.
const props = withDefaults(defineProps<{ amountCents: number; currency?: string }>(), { currency: 'DZD' })

const formatted = computed(() =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: props.currency }).format(props.amountCents / 100)
)
</script>

<template>
  <span class="ads-tabular">{{ formatted }}</span>
</template>
