<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-vue-next'
import type { ClassValue } from 'clsx'
import { cn } from '~/lib/cn'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ads font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      appearance: {
        default: 'bg-ads-hover text-ads-text hover:bg-ads-pressed',
        primary: 'bg-ads-primary text-white hover:bg-ads-primary-hover active:bg-ads-primary-pressed dark:text-[#161a1d]',
        soft: 'bg-ads-selected text-ads-primary hover:bg-ads-selected-hover',
        subtle: 'bg-transparent text-ads-subtle hover:bg-ads-hover active:bg-ads-pressed',
        outline: 'border border-ads-input bg-transparent text-ads-text hover:bg-ads-hover',
        'outline-danger': 'border border-ads-danger bg-transparent text-ads-danger hover:bg-ads-hover',
        link: 'bg-transparent text-ads-primary underline-offset-2 hover:underline',
        danger: 'bg-ads-danger text-white hover:bg-ads-danger-hover active:bg-ads-danger-pressed dark:text-[#161a1d]',
        'soft-danger': 'bg-[#ffecee] text-ads-danger hover:bg-[#ffd5d2] dark:bg-[#42221f] dark:hover:bg-[#5d1f1a]'
      },
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-sm'
      },
      square: { true: 'px-0', false: '' }
    },
    compoundVariants: [
      { square: true, size: 'sm', class: 'w-6' },
      { square: true, size: 'md', class: 'w-8' },
      { square: true, size: 'lg', class: 'w-10' }
    ],
    defaultVariants: { appearance: 'default', size: 'md', square: false }
  }
)

type Appearance = 'default' | 'primary' | 'soft' | 'subtle' | 'outline' | 'outline-danger' | 'link' | 'danger' | 'soft-danger'

// Accepts both the native `appearance` prop and the Nuxt-UI-style
// `color`/`variant`/`size`/`label`/`icon` props the pre-redesign templates use,
// so migrated pages keep reading the same.
const props = withDefaults(defineProps<{
  appearance?: Appearance
  color?: string
  variant?: string
  size?: string
  square?: boolean
  block?: boolean
  loading?: boolean
  disabled?: boolean
  label?: string
  icon?: string
  trailingIcon?: string
  to?: string
  href?: string
  target?: string
  type?: 'button' | 'submit' | 'reset'
  class?: ClassValue
}>(), { type: 'button' })

const resolved = computed<Appearance>(() => {
  if (props.appearance) return props.appearance
  const danger = props.color === 'error'
  switch (props.variant) {
    case 'outline': return danger ? 'outline-danger' : 'outline'
    case 'soft': return danger ? 'soft-danger' : props.color === 'neutral' ? 'default' : 'soft'
    case 'subtle': return danger ? 'soft-danger' : 'default'
    case 'ghost': return 'subtle'
    case 'link': return 'link'
    default: return danger ? 'danger' : props.color === 'neutral' ? 'default' : 'primary'
  }
})
const size = computed<'sm' | 'md' | 'lg'>(() => (props.size === 'xs' || props.size === '2xs' || props.size === 'sm' ? 'sm' : props.size === 'lg' || props.size === 'xl' ? 'lg' : 'md'))
const classes = computed(() => cn(buttonVariants({ appearance: resolved.value, size: size.value, square: props.square }), props.block && 'w-full', props.class))
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <AdsIcon v-if="icon" :name="icon" />
    <slot>{{ label }}</slot>
    <AdsIcon v-if="trailingIcon" :name="trailingIcon" />
  </NuxtLink>
  <a v-else-if="href" :href="href" :target="target" :rel="target === '_blank' ? 'noopener' : undefined" :class="classes">
    <AdsIcon v-if="icon" :name="icon" />
    <slot>{{ label }}</slot>
    <AdsIcon v-if="trailingIcon" :name="trailingIcon" />
  </a>
  <button v-else :type="type" :disabled="disabled || loading" :class="classes">
    <LoaderCircle v-if="loading" class="animate-spin" />
    <AdsIcon v-else-if="icon" :name="icon" />
    <slot>{{ label }}</slot>
    <AdsIcon v-if="trailingIcon" :name="trailingIcon" />
  </button>
</template>
