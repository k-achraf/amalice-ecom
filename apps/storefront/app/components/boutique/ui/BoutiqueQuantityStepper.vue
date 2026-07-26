<script setup lang="ts">
// Boutique's quantity stepper — plain buttons + number input, no @nuxt/ui.
// Sharp-cornered, thin 1px border, restrained.
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
  <div class="inline-flex items-center border border-default" :class="disabled ? 'opacity-40' : ''">
    <button
      type="button"
      class="flex size-8 items-center justify-center text-highlighted transition-colors hover:bg-elevated disabled:cursor-not-allowed"
      :disabled="disabled || modelValue <= min"
      aria-label="Decrease quantity"
      @click="dec"
    >
      <Icon name="i-lucide-minus" class="size-3" />
    </button>
    <input
      :value="modelValue"
      type="text"
      inputmode="numeric"
      :disabled="disabled"
      class="w-9 border-x border-default bg-transparent py-1.5 text-center text-xs font-normal tabular-nums text-highlighted focus:outline-none"
      @input="onInput"
    >
    <button
      type="button"
      class="flex size-8 items-center justify-center text-highlighted transition-colors hover:bg-elevated disabled:cursor-not-allowed"
      :disabled="disabled || (max !== undefined && modelValue >= max)"
      aria-label="Increase quantity"
      @click="inc"
    >
      <Icon name="i-lucide-plus" class="size-3" />
    </button>
  </div>
</template>
