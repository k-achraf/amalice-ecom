<script setup lang="ts">
// Editorial's text input — plain <input> + Tailwind, no @nuxt/ui. ADS's real
// field: a visible 1px border, white surface, and on focus the border goes
// blue plus a matching 1px inner glow.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full rounded-[3px] border border-default bg-white px-3 py-2 text-sm text-highlighted placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-[var(--color-primary-500)] focus:shadow-[0_0_0_1px_var(--color-primary-500)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :class="icon ? 'pl-9' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
