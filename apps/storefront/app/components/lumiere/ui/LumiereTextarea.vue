<script setup lang="ts">
// Lumiere's textarea — plain <textarea> + Tailwind, no @nuxt/ui.
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
    class="w-full resize-y rounded border border-black/20 bg-white px-4 py-2.5 font-medium text-black placeholder:font-normal placeholder:text-black/35 transition-colors duration-150 focus:border-primary-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
