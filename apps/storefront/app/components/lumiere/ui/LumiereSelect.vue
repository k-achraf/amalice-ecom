<script setup lang="ts">
// Lumiere's select — a real native <select>, styled (appearance-none +
// custom chevron), not a hand-rolled listbox. Native selects are keyboard/
// screen-reader accessible for free and need zero JS beyond styling —
// exactly the "plain Tailwind, no component library" brief.
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
      class="w-full appearance-none rounded border border-black/20 bg-white px-4 py-2.5 pr-10 font-medium text-black transition-colors duration-150 focus:border-primary-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-black/60" />
  </div>
</template>
