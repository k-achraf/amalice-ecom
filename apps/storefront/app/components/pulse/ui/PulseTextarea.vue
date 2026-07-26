<script setup lang="ts">
// Pulse's textarea — plain <textarea> + Tailwind, no @nuxt/ui. Rounded-2xl,
// same glow-on-focus language as PulseInput.
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
    class="w-full resize-y rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 transition-all duration-200 focus:border-primary-400 focus:shadow-[var(--shadow-pulse-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
