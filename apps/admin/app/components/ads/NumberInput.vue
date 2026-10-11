<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })

// Numeric field whose model is `number | null` (empty input = null).
const model = defineModel<number | null | undefined>()
const props = defineProps<{ min?: number; max?: number; step?: number; placeholder?: string; class?: string; disabled?: boolean; size?: string }>()

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  model.value = v === '' ? null : Number(v)
}
</script>

<template>
  <div :class="cn('input-wrap', disabled && 'is-disabled', props.class)">
    <input v-bind="$attrs" class="ads-tabular" type="number" inputmode="decimal" :value="model ?? ''" :min="min" :max="max" :step="step" :placeholder="placeholder" :disabled="disabled" @input="onInput">
  </div>
</template>
