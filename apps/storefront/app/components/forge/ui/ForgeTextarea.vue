<script setup lang="ts">
// Forge's textarea — plain <textarea> + Tailwind, no @nuxt/ui.
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
    class="w-full resize-y border-[3px] border-[var(--color-forge-ink)] bg-white px-4 py-2.5 font-medium text-[var(--color-forge-ink)] placeholder:font-normal placeholder:text-[var(--color-forge-ink)]/40 transition-colors duration-150 focus:border-primary-500 focus:bg-primary-50 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
