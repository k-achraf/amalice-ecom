<script setup lang="ts">
// Lumiere's badge — small uppercase sharp-cornered tag chip, no @nuxt/ui.
// Never rounded/pill (the shade-swatch dot is the one exception in the
// whole template) — badges stay sharp by contrast.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'success' | 'error' | 'warning'
  variant?: 'solid' | 'outline' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'solid'
})

const colorHex: Record<string, string> = {
  primary: 'var(--color-primary-600)',
  neutral: '#000000',
  success: '#1a7f37',
  error: 'var(--color-primary-800)',
  warning: '#b45309'
}

const classes = computed(() => {
  if (props.variant === 'solid') {
    return props.color === 'primary' ? 'bg-primary-600 text-white' : ''
  }
  if (props.variant === 'outline') return 'bg-transparent border'
  return 'bg-black/5'
})

const inlineStyle = computed(() => {
  const c = colorHex[props.color]
  if (props.variant === 'solid' && props.color !== 'primary') return { backgroundColor: c, color: '#ffffff' }
  if (props.variant === 'outline') return { borderColor: c, color: c }
  if (props.variant === 'subtle') return { color: c }
  return {}
})
</script>

<template>
  <span
    class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
    :class="classes"
    :style="inlineStyle"
  >
    <slot />
  </span>
</template>
