<script setup lang="ts">
// Nova's text input — plain <input> + Tailwind, no @nuxt/ui. Focus state
// reuses the same hard-shadow "lift" as NovaButton for a consistent feel.
const props = withDefaults(defineProps<{
  modelValue?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  icon?: string
  maxlength?: number
}>(), {
  type: 'text'
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="relative">
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/40" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full border-2 border-black bg-white px-4 py-2.5 font-medium text-black placeholder:font-normal placeholder:text-black/40 transition-all duration-150 focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-[var(--shadow-nova-sm)] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-60"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
