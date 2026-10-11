<script setup lang="ts">
import { cn } from '~/lib/cn'

// Numeric field whose model is `number | null` (empty input = null), unlike a
// plain <input type=number v-model> which yields strings.
const model = defineModel<number | null>()
defineProps<{ min?: number; max?: number; step?: number; placeholder?: string; class?: string; disabled?: boolean }>()

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  model.value = v === '' ? null : Number(v)
}
</script>

<template>
  <input
    type="number"
    inputmode="decimal"
    :value="model ?? ''"
    :min="min"
    :max="max"
    :step="step"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="cn('ads-tabular h-8 w-full rounded-ads border border-ads-input bg-ads-surface px-2 text-sm text-ads-text placeholder:text-ads-subtlest hover:bg-ads-hover focus:bg-ads-surface disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled', $props.class)"
    @input="onInput"
  >
</template>
