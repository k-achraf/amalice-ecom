<script setup lang="ts">
// Volt's textarea — plain <textarea> + Tailwind, no @nuxt/ui.
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
    class="w-full resize-y rounded-md border border-white/10 bg-[#0c1113] px-4 py-2.5 text-sm text-white placeholder:text-white/30 transition-all duration-150 focus:border-primary-400/60 focus:shadow-[var(--shadow-volt-glow)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
