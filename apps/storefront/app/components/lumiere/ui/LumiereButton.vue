<script setup lang="ts">
// Lumiere's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Sharp
// 0.25rem radius, zero shadow — interaction is pure color shift + a tiny
// press-scale, never elevation. Two explicit template branches (NuxtLink vs
// <button>) rather than a dynamic `:is="to ? 'NuxtLink' : 'button'"` — the
// dynamic form fails to resolve during SSR for auto-imported components.
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral' | 'error'
  variant?: 'solid' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
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
  sm: 'text-xs px-3.5 py-1.5 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-7 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-8 p-0',
  md: 'size-10 p-0',
  lg: 'size-12 p-0'
}

// No shadow anywhere — hover/active states are pure color + a tiny press
// scale, never an offset or blurred shadow.
const variantClasses: Record<string, string> = {
  'solid-primary': 'border border-primary-600 bg-primary-600 text-white hover:bg-primary-700 hover:border-primary-700 active:scale-[0.97]',
  'solid-neutral': 'border border-black bg-black text-white hover:bg-neutral-800 hover:border-neutral-800 active:scale-[0.97]',
  'solid-error': 'border border-primary-800 bg-primary-800 text-white hover:bg-primary-900 hover:border-primary-900 active:scale-[0.97]',
  'outline-primary': 'border border-primary-600 bg-transparent text-primary-600 hover:bg-primary-50 active:scale-[0.97]',
  'outline-neutral': 'border border-black bg-transparent text-black hover:bg-neutral-50 active:scale-[0.97]',
  'outline-error': 'border border-primary-800 bg-transparent text-primary-800 hover:bg-primary-50 active:scale-[0.97]',
  'ghost-primary': 'border border-transparent bg-transparent text-primary-600 hover:bg-primary-50',
  'ghost-neutral': 'border border-transparent bg-transparent text-black/70 hover:text-black',
  'ghost-error': 'border border-transparent bg-transparent text-primary-800 hover:bg-primary-50'
}

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses[`${props.variant}-${props.color}`],
  props.block ? 'flex w-full' : ''
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :aria-label="ariaLabel" :class="rootClass">
    <Icon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
    <Icon v-else-if="icon" :name="icon" class="size-4" />
    <slot />
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" class="size-4" />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled || loading" :aria-label="ariaLabel" :class="rootClass">
    <Icon v-if="loading" name="i-lucide-loader-circle" class="size-4 animate-spin" />
    <Icon v-else-if="icon" :name="icon" class="size-4" />
    <slot />
    <Icon v-if="trailingIcon && !loading" :name="trailingIcon" class="size-4" />
  </button>
</template>
