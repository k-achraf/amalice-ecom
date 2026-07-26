<script setup lang="ts">
// Trove's text input — plain <input> + Tailwind, no @nuxt/ui. Sharp,
// minimal-radius field on the cream surface, a soft warm shadow on focus.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full rounded border border-neutral-200 bg-white px-4 py-2.5 text-[var(--color-trove-ink)] placeholder:text-neutral-400 transition-all duration-200 focus:border-primary-500 focus:shadow-[var(--shadow-trove-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
