<script setup lang="ts">
// Drop's text input — plain <input> + Tailwind, no @nuxt/ui. Dark panel
// surface, thin 1px border, accent-colored focus border — no shadow.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full border border-white/15 bg-neutral-900 px-4 py-2.5 font-medium text-white placeholder:font-normal placeholder:text-white/35 transition-colors duration-150 focus:border-primary-500 focus:bg-neutral-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
