<script setup lang="ts">
// Impulse's quantity stepper — big phone-friendly +/- targets in a pill.
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
  <div class="inline-flex items-center gap-1 rounded-full border-2 border-neutral-200 bg-white p-1" :class="disabled ? 'opacity-40' : ''">
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed"
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
      aria-label="الكمية"
      class="w-10 border-0 bg-transparent text-center text-base font-bold tabular-nums text-neutral-900 focus:outline-none"
      @input="onInput"
    >
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed"
      :disabled="disabled || (max !== undefined && modelValue >= max)"
      aria-label="Increase quantity"
      @click="inc"
    >
      <Icon name="i-lucide-plus" class="size-4" />
    </button>
  </div>
</template>
