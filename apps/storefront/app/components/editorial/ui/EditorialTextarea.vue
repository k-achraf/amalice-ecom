<script setup lang="ts">
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
    class="w-full resize-y rounded-[3px] border border-default bg-white px-3 py-2 text-sm text-highlighted placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_1px_var(--color-primary-500)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
