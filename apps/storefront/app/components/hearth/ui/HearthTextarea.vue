<script setup lang="ts">
// Hearth's textarea — plain <textarea> + Tailwind, no @nuxt/ui. Cozy
// rounded-xl corners, same field language as HearthInput.
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
    class="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[var(--color-hearth-ink)] placeholder:text-neutral-400 transition-all duration-200 focus:border-primary-400 focus:shadow-[var(--shadow-hearth-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
