<script setup lang="ts">
// Editorial's badge — ADS's lozenge (fully-rounded pill), solid or subtle.
withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'solid' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'solid'
})

const classesByKey: Record<string, string> = {
  'primary:solid': 'bg-primary text-white',
  'primary:subtle': 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
  'neutral:solid': 'bg-highlighted text-inverted',
  'neutral:subtle': 'bg-neutral-100 text-neutral-700',
  'error:solid': 'bg-red-600 text-white',
  'error:subtle': 'bg-red-50 text-red-700',
  'warning:solid': 'bg-amber-600 text-white',
  'warning:subtle': 'bg-amber-50 text-amber-700',
  'success:solid': 'bg-emerald-600 text-white',
  'success:subtle': 'bg-emerald-50 text-emerald-700'
}
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
    :class="classesByKey[`${color}:${variant}`] ?? classesByKey['primary:solid']"
  >
    <slot />
  </span>
</template>
