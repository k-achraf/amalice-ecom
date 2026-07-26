<script setup lang="ts">
// Boutique's select — a real native <select>, styled to match the
// underlined-field convention (no box, bottom hairline only).
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
      class="w-full appearance-none border-0 border-b border-default bg-transparent py-2 pr-6 text-sm text-highlighted focus:border-b-[var(--color-boutique-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
  </div>
</template>
