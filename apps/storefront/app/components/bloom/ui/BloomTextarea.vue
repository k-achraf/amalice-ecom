<script setup lang="ts">
// Bloom's textarea — plain <textarea> + Tailwind, no @nuxt/ui. Rounded-2xl
// (not fully pill — multiline text needs the extra width a pill would eat).
withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  disabled?: boolean
}>(), {
  rows: 3
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    class="w-full resize-y rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-[var(--color-bloom-ink)] placeholder:text-neutral-400 transition-all duration-200 focus:border-primary-300 focus:shadow-[var(--shadow-bloom-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
