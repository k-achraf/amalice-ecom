<script setup lang="ts">
import { cva } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-vue-next'
import { cn } from '~/lib/cn'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ads font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      appearance: {
        default: 'bg-ads-hover text-ads-text hover:bg-ads-pressed',
        primary: 'bg-ads-primary text-white hover:bg-ads-primary-hover active:bg-ads-primary-pressed dark:text-[#161a1d]',
        subtle: 'bg-transparent text-ads-subtle hover:bg-ads-hover active:bg-ads-pressed',
        outline: 'border border-ads-input bg-transparent text-ads-text hover:bg-ads-hover',
        link: 'bg-transparent text-ads-primary underline-offset-2 hover:underline',
        danger: 'bg-ads-danger text-white hover:bg-ads-danger-hover active:bg-ads-danger-pressed dark:text-[#161a1d]'
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

const props = withDefaults(defineProps<{
  appearance?: 'default' | 'primary' | 'subtle' | 'outline' | 'link' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  square?: boolean
  loading?: boolean
  disabled?: boolean
  to?: string
  type?: 'button' | 'submit' | 'reset'
  class?: string
}>(), { appearance: 'default', size: 'md', type: 'button' })

const classes = computed(() => cn(buttonVariants({ appearance: props.appearance, size: props.size, square: props.square }), props.class))
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled || loading" :class="classes">
    <LoaderCircle v-if="loading" class="animate-spin" />
    <slot />
  </button>
</template>
