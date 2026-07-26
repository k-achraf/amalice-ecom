<script setup lang="ts">
// Promify's text input — plain <input> + Tailwind, no @nuxt/ui. Encodes the
// exact Stripe form-field signature: a real 1px border (not a ring/box-
// shadow illusion), white surface, and on focus the border goes indigo plus
// a soft indigo glow ring — more recognizable as "Stripe Checkout" than any
// color choice.
const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  icon?: string
  maxlength?: number
  min?: number
  size?: 'sm' | 'md'
}>(), {
  type: 'text',
  size: 'md'
})

defineEmits<{ 'update:modelValue': [value: string] }>()

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-3.5 py-2 text-sm rounded-lg'
}
</script>

<template>
  <div class="relative">
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      :min="min"
      class="w-full border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 transition-all duration-150 focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(99,91,255,0.15)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      :class="[sizeClasses[size], icon ? 'pl-9' : '']"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
