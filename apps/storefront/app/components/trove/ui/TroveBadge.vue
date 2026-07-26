<script setup lang="ts">
// Trove's badge — plain <span> + Tailwind, no @nuxt/ui. Sharp, minimal-radius
// chip (never a pill — only photos get to be round in Trove). "teal" is the
// secondary half of the duo-tone accent, reserved for the "collected" /
// secondary callouts.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'teal' | 'error'
  variant?: 'solid' | 'subtle' | 'outline'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classesByColor: Record<string, Record<string, string>> = {
  primary: {
    solid: 'bg-primary-500 text-[var(--color-trove-ink)]',
    subtle: 'bg-primary-50 text-primary-700',
    outline: 'border border-primary-400 text-primary-700 bg-white'
  },
  neutral: {
    solid: 'bg-[var(--color-trove-ink)] text-white',
    subtle: 'bg-neutral-100 text-neutral-600',
    outline: 'border border-neutral-300 text-neutral-600 bg-white'
  },
  teal: {
    solid: 'bg-[var(--color-trove-teal)] text-white',
    subtle: 'bg-[var(--color-trove-teal-light)]/25 text-[var(--color-trove-teal-dark)]',
    outline: 'border border-[var(--color-trove-teal)] text-[var(--color-trove-teal-dark)] bg-white'
  },
  error: {
    solid: 'bg-red-600 text-white',
    subtle: 'bg-red-50 text-red-700',
    outline: 'border border-red-300 text-red-700 bg-white'
  }
}

const rootClass = computed(() => [
  'inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
  classesByColor[props.color]?.[props.variant] ?? classesByColor.primary!.subtle
])
</script>

<template>
  <span :class="rootClass"><slot /></span>
</template>
