<script setup lang="ts">
// Volt's quantity stepper — plain buttons + number input, no @nuxt/ui.
// Thin hairline dividers, tight radius, tabular-mono count.
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
  <div class="inline-flex items-center divide-x divide-white/10 rounded-md border border-white/10" :class="disabled ? 'opacity-40' : ''">
    <button
      type="button"
      class="flex size-10 items-center justify-center text-white transition-colors hover:text-primary-400 disabled:cursor-not-allowed disabled:hover:text-white"
      :disabled="disabled || modelValue <= min"
      aria-label="Decrease quantity"
      @click="dec"
    >
      <Icon name="i-lucide-minus" class="size-4" />
    </button>
    <input
      :value="modelValue"
      type="text"
      inputmode="numeric"
      :disabled="disabled"
      class="font-mono-spec w-12 border-0 bg-transparent py-2 text-center text-sm text-white focus:outline-none"
      @input="onInput"
    >
    <button
      type="button"
      class="flex size-10 items-center justify-center text-white transition-colors hover:text-primary-400 disabled:cursor-not-allowed disabled:hover:text-white"
      :disabled="disabled || (max !== undefined && modelValue >= max)"
      aria-label="Increase quantity"
      @click="inc"
    >
      <Icon name="i-lucide-plus" class="size-4" />
    </button>
  </div>
</template>
