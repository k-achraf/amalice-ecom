<script setup lang="ts">
// Nova's button — plain <button>/NuxtLink + Tailwind, no @nuxt/ui. The
// neubrutalist "press" interaction: a hard offset shadow that grows on
// hover (button lifts up-left) and collapses to nothing on click (button
// presses flat into the shadow) — pure Tailwind transform/shadow utilities.
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
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-7 py-3.5 gap-2.5'
}
const squareSizeClasses: Record<string, string> = {
  sm: 'size-8 p-0',
  md: 'size-10 p-0',
  lg: 'size-12 p-0'
}

const variantClasses: Record<string, string> = {
  solid: 'border-black bg-primary-500 text-black shadow-[var(--shadow-nova-sm)] hover:shadow-[var(--shadow-nova-md)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none',
  outline: 'border-black bg-white text-black shadow-[var(--shadow-nova-sm)] hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
  dark: 'border-black bg-black text-white shadow-[var(--shadow-nova-sm)] hover:bg-primary-500 hover:text-black hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none',
  ghost: 'border-transparent bg-transparent text-black hover:underline underline-offset-4'
}

// Two explicit branches (NuxtLink vs <button>) rather than a dynamic
// `:is="to ? 'NuxtLink' : 'button'"` — TemplateSection.vue's own comments
// document why: resolving an auto-imported component from a bare string in
// `:is` isn't reliable during SSR and can render as an unrecognized custom
// element (content shows as text, but it's not a real interactive <a>).
const rootClass = computed(() => [
  'inline-flex items-center justify-center border-2 font-bold uppercase tracking-wide transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
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
