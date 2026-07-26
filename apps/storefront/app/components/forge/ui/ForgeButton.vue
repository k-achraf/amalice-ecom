<script setup lang="ts">
// Forge's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. No
// shadow to lean on, so the "press" interaction is a color invert on hover
// plus a literal downward translate on click (thick borders read as a
// physical, weighty control).
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral' | 'error'
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
  color: 'primary',
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

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)] hover:bg-[var(--color-forge-ink)] hover:text-primary-500',
    'primary:outline': 'border-[var(--color-forge-ink)] bg-white text-[var(--color-forge-ink)] hover:bg-primary-500',
    'primary:dark': 'border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-primary-500 hover:bg-primary-500 hover:text-[var(--color-forge-ink)]',
    'primary:ghost': 'border-transparent bg-transparent text-[var(--color-forge-ink)] hover:text-primary-700 hover:underline underline-offset-4',
    'neutral:solid': 'border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-white hover:bg-neutral-700',
    'neutral:outline': 'border-[var(--color-forge-ink)] bg-white text-[var(--color-forge-ink)] hover:bg-neutral-100',
    'neutral:dark': 'border-[var(--color-forge-ink)] bg-neutral-800 text-white hover:bg-[var(--color-forge-ink)]',
    'neutral:ghost': 'border-transparent bg-transparent text-neutral-600 hover:text-[var(--color-forge-ink)]',
    'error:solid': 'border-[var(--color-forge-ink)] bg-red-600 text-white hover:bg-red-700',
    'error:outline': 'border-red-600 bg-white text-red-600 hover:bg-red-600 hover:text-white',
    'error:dark': 'border-[var(--color-forge-ink)] bg-red-700 text-white hover:bg-red-800',
    'error:ghost': 'border-transparent bg-transparent text-red-600 hover:text-red-700'
  }
  return map[key] ?? map['primary:solid']
})

// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — that form fails to resolve during
// SSR for auto-imported components and renders as an unrecognized custom
// element.
const rootClass = computed(() => [
  'inline-flex items-center justify-center border-[3px] font-semibold uppercase tracking-wide transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
  props.variant === 'ghost' ? '' : 'active:translate-y-0.5',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses.value,
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
