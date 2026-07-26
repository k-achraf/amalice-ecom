<script setup lang="ts">
// Trove's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. Sharp,
// minimal 0.25rem corners (never a pill) — the button is part of the
// "display case" chrome, not a collected object. Solid primary pairs
// mustard with dark ink text (not white — mustard-500 doesn't have enough
// contrast against white for text), a small "vintage tag" flourish that
// fits Trove's quirky personality.
//
// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — a real bug caught building earlier
// templates: resolving an auto-imported component from a bare string in
// `:is` isn't reliable during SSR and can render as an unrecognized custom
// element (content shows as text, but it's not a real interactive <a>).
const props = withDefaults(defineProps<{
  to?: string
  type?: 'button' | 'submit'
  color?: 'primary' | 'neutral'
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
  sm: 'size-9 p-0',
  md: 'size-11 p-0',
  lg: 'size-13 p-0'
}

const variantClasses = computed<Record<string, string>>(() => ({
  solid: props.color === 'neutral'
    ? 'bg-[var(--color-trove-ink)] text-white shadow-[var(--shadow-trove-sm)] hover:bg-neutral-800 hover:shadow-[var(--shadow-trove-md)]'
    : 'bg-primary-500 text-[var(--color-trove-ink)] shadow-[var(--shadow-trove-sm)] hover:bg-primary-400 hover:shadow-[var(--shadow-trove-md)]',
  outline: 'bg-white text-[var(--color-trove-ink)] border border-neutral-300 hover:border-primary-500 hover:bg-primary-50',
  ghost: 'bg-transparent text-[var(--color-trove-ink)] hover:bg-neutral-100'
}))

const rootClass = computed(() => [
  'inline-flex items-center justify-center rounded font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
  props.square ? squareSizeClasses[props.size] : sizeClasses[props.size],
  variantClasses.value[props.variant],
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
