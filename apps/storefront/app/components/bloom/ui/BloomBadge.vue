<script setup lang="ts">
// Bloom's badge — a small fully-pill tag, filled soft-tint by default (the
// "glow dot" motif's plainer sibling, used for stock/status callouts where
// a leading dot isn't needed).
const props = withDefaults(defineProps<{
  color?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
  variant?: 'solid' | 'soft'
}>(), {
  color: 'primary',
  variant: 'soft'
})

const colorClasses: Record<string, Record<string, string>> = {
  primary: { soft: 'bg-primary-50 text-primary-700', solid: 'bg-primary-500 text-white' },
  error: { soft: 'bg-red-50 text-red-600', solid: 'bg-red-500 text-white' },
  warning: { soft: 'bg-amber-50 text-amber-700', solid: 'bg-amber-500 text-white' },
  success: { soft: 'bg-emerald-50 text-emerald-700', solid: 'bg-emerald-500 text-white' },
  neutral: { soft: 'bg-neutral-100 text-neutral-600', solid: 'bg-neutral-600 text-white' }
}

const badgeClass = computed(() => colorClasses[props.color]?.[props.variant] ?? colorClasses.primary!.soft)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
    :class="badgeClass"
  >
    <slot />
  </span>
</template>
