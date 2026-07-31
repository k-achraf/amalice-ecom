<script setup lang="ts">
// Impulse's badge — a loud little pill. Funnel badges are signals, not
// decoration: green = trust/savings, red = urgency/scarcity, yellow =
// highlight, primary = offer.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'green' | 'red' | 'yellow'
  variant?: 'solid' | 'subtle' | 'outline'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classesByColor: Record<string, Record<string, string>> = {
  primary: {
    solid: 'bg-primary-500 text-white',
    subtle: 'bg-primary-50 text-primary-700',
    outline: 'border-2 border-primary-300 text-primary-700 bg-white'
  },
  neutral: {
    solid: 'bg-neutral-900 text-white',
    subtle: 'bg-neutral-100 text-neutral-600',
    outline: 'border-2 border-neutral-300 text-neutral-600 bg-white'
  },
  green: {
    solid: 'bg-[var(--color-impulse-green)] text-white',
    subtle: 'bg-[var(--color-impulse-green-soft)] text-[var(--color-impulse-green)]',
    outline: 'border-2 border-[var(--color-impulse-green)] text-[var(--color-impulse-green)] bg-white'
  },
  red: {
    solid: 'bg-[var(--color-impulse-red)] text-white',
    subtle: 'bg-[var(--color-impulse-red-soft)] text-[var(--color-impulse-red)]',
    outline: 'border-2 border-[var(--color-impulse-red)] text-[var(--color-impulse-red)] bg-white'
  },
  yellow: {
    solid: 'bg-[var(--color-impulse-yellow)] text-neutral-900',
    subtle: 'bg-[var(--color-impulse-yellow-soft)] text-neutral-800',
    outline: 'border-2 border-[var(--color-impulse-yellow)] text-neutral-800 bg-white'
  }
}

const rootClass = computed(() => [
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide',
  classesByColor[props.color]?.[props.variant] ?? classesByColor.primary!.subtle
])
</script>

<template>
  <span :class="rootClass"><slot /></span>
</template>
