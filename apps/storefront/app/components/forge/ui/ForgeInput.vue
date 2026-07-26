<script setup lang="ts">
// Forge's text input — plain <input> + Tailwind, no @nuxt/ui. No shadow, so
// focus is communicated with a border-color swap to safety-yellow plus a
// faint tint fill.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-forge-ink)]/40" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full border-[3px] border-[var(--color-forge-ink)] bg-white px-4 py-2.5 font-medium text-[var(--color-forge-ink)] placeholder:font-normal placeholder:text-[var(--color-forge-ink)]/40 transition-colors duration-150 focus:border-primary-500 focus:bg-primary-50 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
