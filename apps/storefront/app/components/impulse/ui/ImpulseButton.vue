<script setup lang="ts">
// Impulse's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui.
// Chunky, pill-rounded, bold — a direct-response CTA. The `pulse` prop
// applies the template's signature heartbeat-glow + shine-sweep animation
// (impulse.css .cta-pulse) and is reserved for THE primary action of a
// page: exactly one pulsing element per viewport, so the eye has exactly
// one target.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is` — resolving auto-imported components from a bare string in `:is`
// isn't SSR-reliable (bug caught building Nova).
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral' | 'green' | 'error'
  variant?: 'solid' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  icon?: string
  trailingIcon?: string
  ariaLabel?: string
  square?: boolean
  pulse?: boolean
}>(), {
  type: 'button',
  color: 'primary',
  variant: 'solid',
  size: 'md'
})

const sizeClasses: Record<string, string> = {
  sm: 'text-xs px-4 py-2 gap-1.5',
  md: 'text-sm px-6 py-3 gap-2',
  lg: 'text-base px-8 py-4 gap-2.5',
  xl: 'text-lg px-10 py-5 gap-3'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-9 p-0',
  md: 'size-11 p-0',
  lg: 'size-14 p-0',
  xl: 'size-16 p-0'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary-500 text-white shadow-[var(--shadow-impulse-cta)] hover:bg-primary-600',
    'primary:outline': 'bg-white text-primary-600 border-2 border-primary-300 hover:border-primary-500 hover:bg-primary-50',
    'primary:ghost': 'bg-transparent text-primary-600 hover:bg-primary-50',
    'neutral:solid': 'bg-neutral-900 text-white hover:bg-neutral-800',
    'neutral:outline': 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-neutral-400',
    'neutral:ghost': 'bg-transparent text-neutral-600 hover:bg-neutral-100',
    'green:solid': 'bg-[var(--color-impulse-green)] text-white hover:brightness-110',
    'green:outline': 'bg-white text-[var(--color-impulse-green)] border-2 border-[var(--color-impulse-green)] hover:bg-[var(--color-impulse-green-soft)]',
    'green:ghost': 'bg-transparent text-[var(--color-impulse-green)] hover:bg-[var(--color-impulse-green-soft)]',
    'error:solid': 'bg-red-600 text-white hover:bg-red-700',
    'error:outline': 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400',
    'error:ghost': 'bg-transparent text-red-600 hover:bg-red-50'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-full font-bold uppercase tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:animate-none',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses.value,
  props.block ? 'flex w-full' : '',
  props.pulse && !props.disabled ? 'cta-pulse' : ''
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
