<script setup lang="ts">
// Volt's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Flat,
// engineered look: tight small radius, thin 1px borders, essentially no
// ambient shadow — the only "lift" on hover/focus is a tight cyan glow
// outline (--shadow-volt-glow), never a blurred drop shadow.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — that form fails to resolve during
// SSR for auto-imported components (a real bug caught building Nova).
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
  sm: 'text-xs px-3.5 py-2 gap-1.5',
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
    'primary:solid': 'bg-primary-500 text-black hover:bg-primary-400 hover:shadow-[var(--shadow-volt-glow)] active:bg-primary-600',
    'primary:outline': 'border border-primary-500/40 text-primary-400 hover:border-primary-400 hover:shadow-[var(--shadow-volt-glow)]',
    'primary:ghost': 'text-primary-400 hover:text-primary-300',
    'neutral:solid': 'bg-white text-black hover:bg-neutral-100',
    'neutral:outline': 'border border-white/15 text-white hover:border-white/30 hover:shadow-[var(--shadow-volt-glow)]',
    'neutral:ghost': 'text-white/60 hover:text-white',
    'error:solid': 'bg-red-500 text-black hover:bg-red-400',
    'error:outline': 'border border-red-500/40 text-red-400 hover:border-red-400',
    'error:ghost': 'text-red-400 hover:text-red-300'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:shadow-[var(--shadow-volt-glow)] disabled:cursor-not-allowed disabled:opacity-40',
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
