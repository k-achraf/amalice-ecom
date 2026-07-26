<script setup lang="ts">
// Drop's badge — small uppercase pill/tag chip, no @nuxt/ui. Distinct from
// the rotated `.sticker` motif (drop.css) — this is a static, non-rotated
// inline label used inline with text (e.g. category tags, size chips).
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'success' | 'error' | 'warning'
  variant?: 'solid' | 'outline' | 'subtle'
}>(), {
  color: 'primary',
  variant: 'solid'
})

const colorHex: Record<string, string> = {
  primary: 'var(--color-primary-500)',
  neutral: '#ffffff',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b'
}

const classes = computed(() => {
  const c = colorHex[props.color]
  if (props.variant === 'solid') {
    return props.color === 'primary'
      ? 'bg-primary-500 text-black'
      : 'text-black'
  }
  if (props.variant === 'outline') return 'bg-transparent border'
  return 'bg-white/10'
})

const inlineStyle = computed(() => {
  const c = colorHex[props.color]
  if (props.variant === 'solid' && props.color !== 'primary') return { backgroundColor: c }
  if (props.variant === 'outline') return { borderColor: c, color: c }
  if (props.variant === 'subtle') return { color: c }
  return {}
})
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
    :class="classes"
    :style="inlineStyle"
  >
    <slot />
  </span>
</template>
