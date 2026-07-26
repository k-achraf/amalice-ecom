<script setup lang="ts">
// Editorial's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui.
// ADS's tight small-radius signature, semibold label, and the raised
// elevation shadow on hover instead of a color shift alone.
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
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
  xl: 'text-base px-6 py-3 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-7 p-0',
  md: 'size-8 p-0',
  lg: 'size-9 p-0',
  xl: 'size-10 p-0'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary text-white hover:bg-[var(--color-primary-600)] hover:shadow-[var(--shadow-editorial-raised)]',
    'primary:outline': 'border border-[var(--color-primary-500)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]',
    'primary:ghost': 'text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)]',
    'primary:link': 'text-[var(--color-primary-600)] hover:underline !p-0',
    'neutral:solid': 'bg-highlighted text-inverted hover:opacity-90',
    'neutral:outline': 'border border-default text-highlighted hover:border-highlighted hover:bg-elevated',
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
  'inline-flex items-center justify-center rounded-[3px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)]',
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
