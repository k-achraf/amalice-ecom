<script setup lang="ts">
// Boutique's text input — plain <input> + Tailwind, no @nuxt/ui. The
// underlined field: no box, no ring, a bottom hairline only — the
// print-catalog-order-form convention, Boutique's single most distinctive
// form signature.
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
    <Icon v-if="icon" :name="icon" class="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-muted" />
    <input
      :value="modelValue ?? ''"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="w-full border-0 border-b border-default bg-transparent py-2 text-sm text-highlighted placeholder:text-muted focus:border-b-[var(--color-boutique-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      :class="icon ? 'pl-6' : ''"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </div>
</template>
