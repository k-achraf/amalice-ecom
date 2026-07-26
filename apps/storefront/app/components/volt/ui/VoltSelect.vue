<script setup lang="ts">
// Volt's select — a real native <select>, styled (appearance-none + custom
// chevron), not a hand-rolled listbox. Native selects are keyboard/
// screen-reader accessible for free and need zero JS beyond styling —
// same reasoning as Nova/Atelier's select.
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
      class="w-full appearance-none rounded-md border border-white/10 bg-[#0c1113] px-4 py-2.5 pr-10 text-sm text-white transition-all duration-150 focus:border-primary-400/60 focus:shadow-[var(--shadow-volt-glow)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled hidden class="bg-[#0c1113]">{{ placeholder ?? 'Select…' }}</option>
      <option v-for="item in props.items" :key="item.value" :value="item.value" class="bg-[#0c1113]">{{ item.label }}</option>
    </select>
    <Icon name="i-lucide-chevron-down" class="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" />
  </div>
</template>
