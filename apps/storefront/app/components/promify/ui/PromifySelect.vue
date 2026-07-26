<script setup lang="ts">
// Promify's select — a real native <select>, styled, not a hand-rolled
// listbox. Same border+focus-glow treatment as PromifyInput.
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
      class="w-full appearance-none rounded-lg border border-neutral-200 bg-white px-3.5 py-2 pr-9 text-sm text-neutral-900 transition-all duration-150 focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(99,91,255,0.15)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
  </div>
</template>
