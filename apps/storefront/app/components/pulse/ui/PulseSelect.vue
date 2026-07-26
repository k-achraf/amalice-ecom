<script setup lang="ts">
// Pulse's select — a real native <select>, styled (appearance-none + custom
// chevron), not a hand-rolled listbox. Native selects are accessible for
// free and need zero JS beyond styling — exactly what the cascading
// wilaya→commune picker needs.
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
      class="w-full appearance-none rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 pr-11 text-neutral-900 transition-all duration-200 focus:border-primary-400 focus:shadow-[var(--shadow-pulse-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
  </div>
</template>
