<script setup lang="ts">
// Drop's textarea — plain <textarea> + Tailwind, no @nuxt/ui.
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
    class="w-full resize-y border border-white/15 bg-neutral-900 px-4 py-2.5 font-medium text-white placeholder:font-normal placeholder:text-white/35 transition-colors duration-150 focus:border-primary-500 focus:bg-neutral-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
