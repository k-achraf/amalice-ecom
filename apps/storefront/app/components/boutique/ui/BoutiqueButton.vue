<script setup lang="ts">
// Boutique's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui.
// Sharp corners (no radius classes at all — restraint, not rounded-none
// overrides), uppercase tracked thin-weight label, a 1px offset outline on
// focus instead of a glow/shadow.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic `:is`
// — the SSR pitfall caught building Nova.
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral' | 'error'
  variant?: 'solid' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  icon?: string
  trailingIcon?: string
  ariaLabel?: string
  square?: boolean
}>(), {
  type: 'button',
  color: 'primary',
  variant: 'solid',
  size: 'md'
})

const sizeClasses: Record<string, string> = {
  sm: 'text-[11px] px-4 py-2 gap-1.5',
  md: 'text-xs px-6 py-2.5 gap-2',
  lg: 'text-xs px-8 py-3 gap-2',
  xl: 'text-xs px-10 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-8 p-0',
  md: 'size-9 p-0',
  lg: 'size-10 p-0',
  xl: 'size-11 p-0'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-highlighted text-inverted hover:opacity-85',
    'primary:outline': 'border border-highlighted text-highlighted hover:bg-highlighted hover:text-inverted',
    'primary:ghost': 'text-highlighted hover:opacity-70',
    'primary:link': 'text-highlighted hover:underline !p-0',
    'neutral:solid': 'bg-highlighted text-inverted hover:opacity-85',
    'neutral:outline': 'border border-default text-highlighted hover:border-highlighted',
    'neutral:ghost': 'text-muted hover:text-highlighted',
    'neutral:link': 'text-muted hover:text-highlighted hover:underline !p-0',
    'error:solid': 'bg-red-600 text-white hover:bg-red-700',
    'error:outline': 'border border-red-300 text-red-600 hover:bg-red-50',
    'error:ghost': 'text-red-600 hover:bg-red-50',
    'error:link': 'text-red-600 hover:underline !p-0'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center font-normal uppercase tracking-[0.08em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--color-boutique-accent)]',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses.value,
  props.block ? 'flex w-full' : ''
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :aria-label="ariaLabel" :class="rootClass">
    <Icon v-if="loading" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
    <Icon v-else-if="icon" :name="icon" class="size-3.5" />
    <slot />
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" class="size-3.5" />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled || loading" :aria-label="ariaLabel" :class="rootClass">
    <Icon v-if="loading" name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
    <Icon v-else-if="icon" :name="icon" class="size-3.5" />
    <slot />
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" class="size-3.5" />
  </button>
</template>
