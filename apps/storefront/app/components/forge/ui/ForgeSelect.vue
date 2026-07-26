<script setup lang="ts">
// Forge's select — a real native <select>, styled (appearance-none + custom
// chevron), not a hand-rolled listbox. Keyboard/screen-reader accessible
// for free, and works great for the cascading wilaya→commune picker.
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
      class="w-full appearance-none border-[3px] border-[var(--color-forge-ink)] bg-white px-4 py-2.5 pr-10 font-medium text-[var(--color-forge-ink)] transition-colors duration-150 focus:border-primary-500 focus:bg-primary-50 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-forge-ink)]" />
  </div>
</template>
