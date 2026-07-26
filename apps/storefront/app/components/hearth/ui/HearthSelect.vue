<script setup lang="ts">
// Hearth's select — a real native <select>, styled (appearance-none +
// custom chevron), not a hand-rolled listbox. Native selects are
// accessible for free and need zero JS beyond styling — exactly what the
// cascading wilaya→commune picker needs.
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
      class="w-full appearance-none rounded-xl border border-neutral-200 bg-white px-4 py-2.5 pr-10 text-[var(--color-hearth-ink)] transition-all duration-200 focus:border-primary-400 focus:shadow-[var(--shadow-hearth-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
  </div>
</template>
