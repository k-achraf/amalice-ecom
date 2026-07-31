<script setup lang="ts">
// Impulse's select — a real native <select> (accessible for free, zero JS),
// styled to match ImpulseInput's big-touch-target funnel fields.
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
      class="w-full appearance-none rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 pr-11 text-neutral-900 transition-all duration-150 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
  </div>
</template>
