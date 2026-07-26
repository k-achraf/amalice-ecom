<script setup lang="ts">
// Minimal's button (the Polaris fallback) — plain <button>/NuxtLink +
// Tailwind, no @nuxt/ui. Near-black primary, rounded-md, ring-based focus.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic `:is`
// — the SSR pitfall caught building Nova.
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral' | 'error'
  variant?: 'solid' | 'outline' | 'ghost' | 'link'
  size?: 'xs' | 'sm' | 'md' | 'lg'
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
  xs: 'text-xs px-2.5 py-1 gap-1',
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2'
}
const squareSizeClasses: Record<string, string> = {
  xs: 'size-6 p-0',
  sm: 'size-8 p-0',
  md: 'size-9 p-0',
  lg: 'size-10 p-0'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary text-inverted hover:opacity-90',
    'primary:outline': 'border border-primary text-primary hover:bg-elevated',
    'primary:ghost': 'text-primary hover:bg-elevated',
    'primary:link': 'text-primary hover:underline !p-0',
    'neutral:solid': 'bg-highlighted text-inverted hover:opacity-90',
    'neutral:outline': 'border border-default text-highlighted hover:bg-elevated',
    'neutral:ghost': 'text-muted hover:text-highlighted hover:bg-elevated',
    'neutral:link': 'text-muted hover:text-highlighted hover:underline !p-0',
    'error:solid': 'bg-red-600 text-white hover:bg-red-700',
    'error:outline': 'border border-red-300 text-red-600 hover:bg-red-50',
    'error:ghost': 'text-red-600 hover:bg-red-50',
    'error:link': 'text-red-600 hover:underline !p-0'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
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
