<script setup lang="ts">
// Volt's text input — plain <input> + Tailwind, no @nuxt/ui. Dark surface,
// thin hairline border, tight radius, cyan glow outline on focus (no
// blurred shadow).
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full rounded-md border border-white/10 bg-[#0c1113] px-4 py-2.5 text-sm text-white placeholder:text-white/30 transition-all duration-150 focus:border-primary-400/60 focus:shadow-[var(--shadow-volt-glow)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      :class="icon ? 'pl-10' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
