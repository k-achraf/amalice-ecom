<script setup lang="ts">
// Nova's textarea — plain <textarea> + Tailwind, no @nuxt/ui.
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
    class="w-full resize-y border-2 border-black bg-white px-4 py-2.5 font-medium text-black placeholder:font-normal placeholder:text-black/40 transition-all duration-150 focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[var(--shadow-nova-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
