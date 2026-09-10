<script setup lang="ts">
// Quartz's badge/pill — plain Tailwind, no @nuxt/ui.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'green' | 'red'
  variant?: 'solid' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classes = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary-600 text-white',
    'primary:subtle': 'bg-primary-50 text-primary-700',
    'neutral:solid': 'bg-neutral-900 text-white',
    'neutral:subtle': 'bg-neutral-100 text-neutral-700',
    'green:solid': 'bg-[var(--color-quartz-green)] text-white',
    'green:subtle': 'bg-[var(--color-quartz-green-soft)] text-[var(--color-quartz-green)]',
    'red:solid': 'bg-[var(--color-quartz-red)] text-white',
    'red:subtle': 'bg-red-50 text-[var(--color-quartz-red)]'
  }
  return map[key] ?? map['primary:subtle']
})
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" :class="classes">
    <slot />
  </span>
</template>
