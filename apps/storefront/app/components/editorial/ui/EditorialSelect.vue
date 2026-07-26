<script setup lang="ts">
// Editorial's select — a real native <select>, styled to match the
// bordered-field convention.
const props = defineProps<{
  modelValue?: string
  items: { label: string; value: string }[]
  placeholder?: string
  disabled?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="relative">
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      class="w-full appearance-none rounded-[3px] border border-default bg-white py-2 pl-3 pr-8 text-sm text-highlighted transition-[border-color,box-shadow] duration-150 focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_1px_var(--color-primary-500)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
  </div>
</template>
