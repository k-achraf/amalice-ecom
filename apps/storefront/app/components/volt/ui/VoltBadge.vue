<script setup lang="ts">
// Volt's badge — the bracket-style spec-tag motif ([ NEW ] / [ IN STOCK ])
// in tabular monospace (see .spec-badge in volt.css). "Solid" trades the
// bracket motif for a filled chip — brackets read best on the bare dark
// surface, not a filled block.
withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning' | 'success'
  variant?: 'solid' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'subtle'
})

const classesByKey: Record<string, string> = {
  'primary:solid': 'bg-primary-500 text-black',
  'primary:subtle': 'text-primary-400',
  'neutral:solid': 'bg-white text-black',
  'neutral:subtle': 'text-white/60',
  'error:solid': 'bg-red-500 text-black',
  'error:subtle': 'text-red-400',
  'warning:solid': 'bg-amber-400 text-black',
  'warning:subtle': 'text-amber-400',
  'success:solid': 'bg-emerald-400 text-black',
  'success:subtle': 'text-emerald-400'
}
</script>

<template>
  <span
    class="spec-badge"
    :class="[
      classesByKey[`${color}:${variant}`] ?? classesByKey['primary:subtle'],
      variant === 'solid' ? 'spec-badge-solid rounded-md px-2 py-0.5' : ''
    ]"
  >
    <slot />
  </span>
</template>
