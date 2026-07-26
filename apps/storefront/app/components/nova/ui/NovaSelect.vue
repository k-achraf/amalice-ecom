<script setup lang="ts">
// Nova's select — a real native <select>, styled (appearance-none + custom
// chevron), not a hand-rolled listbox. Deliberate choice: native selects are
// keyboard/screen-reader accessible for free, work great for the cascading
// wilaya→commune picker, and need zero JS beyond styling — exactly the
// "plain Tailwind, no component library" brief for Nova.
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
      class="w-full appearance-none border-2 border-black bg-white px-4 py-2.5 pr-10 font-medium text-black transition-all duration-150 focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[var(--shadow-nova-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden>{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-black" />
  </div>
</template>
