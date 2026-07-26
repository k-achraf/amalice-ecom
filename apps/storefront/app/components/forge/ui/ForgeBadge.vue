<script setup lang="ts">
// Forge's badge — sharp bordered tag, no @nuxt/ui. Solid variant carries a
// thin hazard-stripe tab fused to its left edge (the "badge edges" accent
// called for in the brief); outline/subtle stay plain so the motif doesn't
// get overused.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'success' | 'error' | 'warning'
  variant?: 'solid' | 'outline' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'solid'
})

const colorClasses = computed(() => {
  const map: Record<string, string> = {
    'primary:solid': 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)]',
    'primary:outline': 'border-[var(--color-forge-ink)] bg-transparent text-[var(--color-forge-ink)]',
    'primary:subtle': 'border-primary-300 bg-primary-50 text-primary-800',
    'neutral:solid': 'border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-white',
    'neutral:outline': 'border-[var(--color-forge-ink)] bg-transparent text-[var(--color-forge-ink)]',
    'neutral:subtle': 'border-neutral-300 bg-neutral-100 text-neutral-700',
    'success:solid': 'border-[var(--color-forge-ink)] bg-emerald-600 text-white',
    'success:outline': 'border-emerald-600 bg-transparent text-emerald-700',
    'success:subtle': 'border-emerald-300 bg-emerald-50 text-emerald-800',
    'error:solid': 'border-[var(--color-forge-ink)] bg-red-600 text-white',
    'error:outline': 'border-red-600 bg-transparent text-red-700',
    'error:subtle': 'border-red-300 bg-red-50 text-red-700',
    'warning:solid': 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)]',
    'warning:outline': 'border-primary-600 bg-transparent text-primary-800',
    'warning:subtle': 'border-primary-300 bg-primary-50 text-primary-800'
  }
  return map[`${props.color}:${props.variant}`] ?? map['primary:solid']
})

const showHazardTab = computed(() => props.variant === 'solid')
</script>

<template>
  <span
    class="relative inline-flex items-center gap-1 border-[3px] py-1 text-[11px] font-semibold uppercase tracking-wide"
    :class="[colorClasses, showHazardTab ? 'pl-3.5 pr-2.5' : 'px-2.5']"
  >
    <span v-if="showHazardTab" class="hazard-stripe absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
    <slot />
  </span>
</template>
