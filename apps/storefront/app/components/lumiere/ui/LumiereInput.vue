<script setup lang="ts">
// Lumiere's text input — plain <input> + Tailwind, no @nuxt/ui. White
// panel, thin 1px black border, crimson focus border — no shadow, sharp
// 0.25rem radius.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/40" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full rounded border border-black/20 bg-white px-4 py-2.5 font-medium text-black placeholder:font-normal placeholder:text-black/35 transition-colors duration-150 focus:border-primary-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
