<script setup lang="ts">
// Promify's quantity stepper — plain buttons + number input, no @nuxt/ui.
const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  disabled?: boolean
}>(), {
  min: 1
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function clamp(v: number) {
  let n = Number.isFinite(v) ? v : props.min
  if (n < props.min) n = props.min
  if (props.max !== undefined && n > props.max) n = props.max
  return n
}

function dec() {
  emit('update:modelValue', clamp(props.modelValue - 1))
}
function inc() {
  emit('update:modelValue', clamp(props.modelValue + 1))
}
function onInput(e: Event) {
  emit('update:modelValue', clamp(Number((e.target as HTMLInputElement).value)))
}
</script>

<template>
  <div class="inline-flex items-center divide-x divide-neutral-200 rounded-lg border border-neutral-200 bg-white" :class="disabled ? 'opacity-40' : ''">
    <button
      type="button"
      class="flex size-9 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed"
      :disabled="disabled || modelValue <= min"
      aria-label="Decrease quantity"
      @click="dec"
    >
      <Icon name="i-lucide-minus" class="size-3.5" />
    </button>
    <input
      :value="modelValue"
      type="text"
      inputmode="numeric"
      :disabled="disabled"
      class="w-10 border-0 bg-transparent py-2 text-center text-sm font-medium tabular-nums text-neutral-900 focus:outline-none disabled:bg-transparent"
      @input="onInput"
    >
    <button
      type="button"
      class="flex size-9 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed"
      :disabled="disabled || (max !== undefined && modelValue >= max)"
      aria-label="Increase quantity"
      @click="inc"
    >
      <Icon name="i-lucide-plus" class="size-3.5" />
    </button>
  </div>
</template>
