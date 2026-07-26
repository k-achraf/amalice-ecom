<script setup lang="ts">
// Pulse's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui.
// Rounded-2xl, glossy — the solid variant carries the signature violet glow
// shadow that blooms further on hover, echoing a glossy gadget-store CTA.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — a real bug caught building Nova:
// resolving an auto-imported component from a bare string in `:is` isn't
// reliable during SSR and can render as an unrecognized custom element.
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
  sm: 'text-xs px-4 py-2 gap-1.5',
  md: 'text-sm px-6 py-2.5 gap-2',
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
    'primary:solid': 'bg-primary-500 text-white shadow-[var(--shadow-pulse-sm)] hover:bg-primary-600 hover:shadow-[var(--shadow-pulse-md)]',
    'primary:outline': 'bg-white text-primary-700 border-2 border-primary-200 hover:border-primary-400 hover:bg-primary-50',
    'primary:ghost': 'bg-transparent text-primary-600 hover:bg-primary-50',
    'primary:dark': 'bg-neutral-900 text-white shadow-[var(--shadow-pulse-sm)] hover:bg-neutral-800',
    'neutral:solid': 'bg-neutral-900 text-white hover:bg-neutral-800',
    'neutral:outline': 'bg-white text-neutral-700 border-2 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
    'neutral:ghost': 'bg-transparent text-neutral-600 hover:bg-neutral-100',
    'neutral:dark': 'bg-neutral-900 text-white hover:bg-neutral-800',
    'error:solid': 'bg-red-600 text-white hover:bg-red-700',
    'error:outline': 'bg-white text-red-600 border-2 border-red-200 hover:border-red-400 hover:bg-red-50',
    'error:ghost': 'bg-transparent text-red-600 hover:bg-red-50',
    'error:dark': 'bg-red-700 text-white hover:bg-red-800'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
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
