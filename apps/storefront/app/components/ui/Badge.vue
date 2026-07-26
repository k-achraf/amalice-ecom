<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'solid' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classesByKey: Record<string, string> = {
  'primary:solid': 'bg-primary text-inverted',
  'primary:subtle': 'bg-elevated text-highlighted',
  'neutral:solid': 'bg-highlighted text-inverted',
  'neutral:subtle': 'bg-elevated text-muted',
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
    class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
    :class="classesByKey[`${color}:${variant}`] ?? classesByKey['primary:subtle']"
  >
    <slot />
  </span>
</template>
