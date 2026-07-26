<script setup lang="ts">
// Drop's select — a real native <select>, styled (appearance-none + custom
// chevron), not a hand-rolled listbox. Native selects are keyboard/
// screen-reader accessible for free and need zero JS beyond styling.
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
      class="w-full appearance-none border border-white/15 bg-neutral-900 px-4 py-2.5 pr-10 font-medium text-white transition-colors duration-150 focus:border-primary-500 focus:bg-neutral-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value" class="bg-neutral-900 text-white">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/50" />
  </div>
</template>
