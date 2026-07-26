<script setup lang="ts">
// Promify's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui.
// Encodes exactly the look the old UButton + [data-slot=base] CSS re-skin
// produced: font-semibold, the signature indigo "glow" shadow on hover, a
// soft indigo focus ring instead of a hard outline. Radius comes for free
// from Tailwind's rounded-* utilities, which already resolve through the
// scoped --ui-radius token (promify.css) — no per-component radius logic
// needed.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic `:is`
// — the SSR pitfall caught building Nova: resolving an auto-imported
// component from a bare string in `:is` isn't reliable during SSR.
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
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-3.5 py-2 gap-1.5 rounded-lg',
  lg: 'text-sm px-4 py-2.5 gap-2 rounded-lg',
  xl: 'text-base px-5 py-3 gap-2 rounded-xl'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-8 p-0 rounded-md',
  md: 'size-9 p-0 rounded-lg',
  lg: 'size-10 p-0 rounded-lg',
  xl: 'size-11 p-0 rounded-xl'
}

const variantClasses = computed(() => {
  const key = `${props.color}:${props.variant}`
  const map: Record<string, string> = {
    'primary:solid': 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-[var(--shadow-promify-glow)]',
    'primary:outline': 'border border-primary-200 text-primary-700 hover:bg-primary-50',
    'primary:ghost': 'text-primary-600 hover:bg-primary-50',
    'primary:link': 'text-primary-600 hover:underline !p-0 !rounded-none',
    'neutral:solid': 'bg-neutral-900 text-white hover:bg-neutral-800',
    'neutral:outline': 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50',
    'neutral:ghost': 'text-neutral-600 hover:bg-neutral-100',
    'neutral:link': 'text-neutral-600 hover:underline !p-0 !rounded-none',
    'error:solid': 'bg-red-500 text-white hover:bg-red-600',
    'error:outline': 'border border-red-200 text-red-600 hover:bg-red-50',
    'error:ghost': 'text-red-600 hover:bg-red-50',
    'error:link': 'text-red-600 hover:underline !p-0 !rounded-none'
  }
  return map[key] ?? map['primary:solid']
})

const rootClass = computed(() => [
  'inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(99,91,255,0.25)]',
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
