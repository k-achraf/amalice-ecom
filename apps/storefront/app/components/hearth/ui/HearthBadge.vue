<script setup lang="ts">
// Hearth's badge — plain <span> + Tailwind, no @nuxt/ui. Small rounded-full
// pill (the same "material swatch" language used for stock/status callouts
// across the PDP and product cards).
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'sage' | 'error'
  variant?: 'solid' | 'subtle' | 'outline'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classesByColor: Record<string, Record<string, string>> = {
  primary: {
    solid: 'bg-primary-500 text-white',
    subtle: 'bg-primary-50 text-primary-700',
    outline: 'border border-primary-300 text-primary-700 bg-white'
  },
  neutral: {
    solid: 'bg-[var(--color-hearth-ink)] text-white',
    subtle: 'bg-neutral-100 text-neutral-600',
    outline: 'border border-neutral-300 text-neutral-600 bg-white'
  },
  sage: {
    solid: 'bg-[var(--color-hearth-sage)] text-white',
    subtle: 'bg-[var(--color-hearth-sage-light)]/30 text-[var(--color-hearth-sage-dark)]',
    outline: 'border border-[var(--color-hearth-sage-light)] text-[var(--color-hearth-sage-dark)] bg-white'
  },
  error: {
    solid: 'bg-red-600 text-white',
    subtle: 'bg-red-50 text-red-700',
    outline: 'border border-red-300 text-red-700 bg-white'
  }
}

const rootClass = computed(() => [
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
  classesByColor[props.color]?.[props.variant] ?? classesByColor.primary!.subtle
])
</script>

<template>
  <span :class="rootClass"><slot /></span>
</template>
