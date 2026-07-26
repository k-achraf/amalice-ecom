<script setup lang="ts">
// Atelier's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Fully
// rounded (pill), soft rose-gold glow that blooms on hover — the opposite
// interaction language from Nova's hard-shadow "press."
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — a real bug caught building Nova:
// resolving an auto-imported component from a bare string in `:is` isn't
// reliable during SSR and can render as an unrecognized custom element
// (content shows as text, but it's not a real interactive <a>).
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
  sm: 'text-xs px-4 py-2 gap-1.5',
  md: 'text-sm px-6 py-3 gap-2',
  lg: 'text-base px-8 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-9 p-0',
  md: 'size-11 p-0',
  lg: 'size-13 p-0'
}

const variantClasses: Record<string, string> = {
  solid: 'bg-primary-500 text-white shadow-[var(--shadow-atelier-sm)] hover:bg-primary-600 hover:shadow-[var(--shadow-atelier-md)]',
  outline: 'bg-transparent text-[var(--color-atelier-ink)] border border-primary-400 hover:border-primary-600 hover:bg-primary-50',
  dark: 'bg-[var(--color-atelier-velvet)] text-[var(--color-atelier-cream)] shadow-[var(--shadow-atelier-velvet)] hover:bg-primary-600',
  ghost: 'bg-transparent text-[var(--color-atelier-ink)] hover:text-primary-600'
}

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-full font-medium tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
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
