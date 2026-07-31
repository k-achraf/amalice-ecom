<script setup lang="ts">
// Impulse's text input — plain <input> + Tailwind, no @nuxt/ui. Big touch
// target (funnels are filled on phones), rounded-xl, orange focus ring.
const props = withDefaults(defineProps<{
  modelValue?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  icon?: string
  maxlength?: number
}>(), {
  type: 'text'
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="relative">
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 transition-all duration-150 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      :class="icon ? 'pl-11' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
