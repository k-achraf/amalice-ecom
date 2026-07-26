<script setup lang="ts">
// Trove's quantity stepper — plain buttons + number input, no @nuxt/ui. A
// sharp-cornered container with square +/- buttons matching the template's
// minimal-radius chrome.
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
  <div class="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white p-1" :class="disabled ? 'opacity-40' : ''">
    <button
      type="button"
      class="flex size-8 items-center justify-center rounded text-[var(--color-trove-ink)] transition-colors hover:bg-primary-50 disabled:cursor-not-allowed"
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
      class="w-10 border-0 bg-transparent text-center text-sm font-bold tabular-nums text-[var(--color-trove-ink)] focus:outline-none"
      @input="onInput"
    >
    <button
      type="button"
      class="flex size-8 items-center justify-center rounded text-[var(--color-trove-ink)] transition-colors hover:bg-primary-50 disabled:cursor-not-allowed"
      :disabled="disabled || (max !== undefined && modelValue >= max)"
      aria-label="Increase quantity"
      @click="inc"
    >
      <Icon name="i-lucide-plus" class="size-3.5" />
    </button>
  </div>
</template>
