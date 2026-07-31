<script setup lang="ts">
// Impulse's textarea — plain <textarea> + Tailwind, same field language as
// ImpulseInput.
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
    class="w-full resize-y rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 transition-all duration-150 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
