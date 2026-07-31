<script setup lang="ts">
// Cents-based (integer), never floats — avoids float rounding bugs in money
// math. Keep this convention aligned with the Order schema in
// packages/shared once it exists (FND-05).
const props = withDefaults(defineProps<{ amountCents: number; currency?: string }>(), {
  currency: 'DZD' // Algerian Dinar — the store's target market
})

const formatted = computed(() =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: props.currency }).format(props.amountCents / 100)
)
</script>

<template>
  <span class="tabular">{{ formatted }}</span>
</template>
