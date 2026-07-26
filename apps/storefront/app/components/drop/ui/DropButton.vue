<script setup lang="ts">
// Drop's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Flat,
// zero-shadow interaction: color shifts + a small tactile press-scale on
// active, never a shadow (Drop's defining "no shadow anywhere" rule).
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  variant?: 'solid' | 'outline' | 'dark' | 'ghost'
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
  variant: 'solid',
  size: 'md'
})

const sizeClasses: Record<string, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-7 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-8 p-0',
  md: 'size-10 p-0',
  lg: 'size-12 p-0'
}

// No shadow anywhere — hover/active states are pure color + a tiny press
// scale, never an offset shadow (that's Nova's tell, not Drop's).
const variantClasses: Record<string, string> = {
  solid: 'border border-primary-500 bg-primary-500 text-black hover:bg-primary-400 hover:border-primary-400 active:scale-[0.97]',
  outline: 'border border-white/25 bg-transparent text-white hover:border-primary-500 hover:text-primary-500 active:scale-[0.97]',
  dark: 'border border-white bg-white text-black hover:border-primary-500 hover:bg-primary-500 active:scale-[0.97]',
  ghost: 'border border-transparent bg-transparent text-white/70 hover:text-white'
}

// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — resolving an auto-imported component
// from a bare string in `:is` isn't reliable during SSR and can render as an
// unrecognized custom element.
const rootClass = computed(() => [
  'inline-flex items-center justify-center font-bold uppercase tracking-wide transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses[props.variant],
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
