<script setup lang="ts">
// Bloom's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Fully
// rounded (pill), soft bubblegum-pink glow that blooms further on hover —
// same soft "lift" interaction language as Atelier, tuned to Bloom's
// dreamier, lower-opacity shadow tokens.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — a real bug caught building Nova:
// resolving an auto-imported component from a bare string in `:is` isn't
// reliable during SSR and can render as an unrecognized custom element
// (content shows as text, but it's not a real interactive <a>).
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
  sm: 'text-xs px-4 py-2 gap-1.5',
  md: 'text-sm px-6 py-3 gap-2',
  lg: 'text-base px-8 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-9 p-0',
  md: 'size-11 p-0',
  lg: 'size-13 p-0'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary-500 text-white shadow-[var(--shadow-bloom-sm)] hover:bg-primary-600 hover:shadow-[var(--shadow-bloom-md)]',
    'primary:outline': 'bg-transparent text-primary-600 border border-primary-300 hover:border-primary-500 hover:bg-primary-50',
    'primary:ghost': 'bg-transparent text-primary-600 hover:bg-primary-50',
    'neutral:solid': 'bg-[var(--color-bloom-ink)] text-white shadow-[var(--shadow-bloom-sm)] hover:opacity-90',
    'neutral:outline': 'bg-transparent text-[var(--color-bloom-ink)] border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50',
    'neutral:ghost': 'bg-transparent text-neutral-500 hover:bg-neutral-50 hover:text-[var(--color-bloom-ink)]',
    'error:solid': 'bg-red-500 text-white shadow-[var(--shadow-bloom-sm)] hover:bg-red-600',
    'error:outline': 'bg-transparent text-red-600 border border-red-300 hover:bg-red-50',
    'error:ghost': 'bg-transparent text-red-600 hover:bg-red-50'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-full font-medium tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
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
