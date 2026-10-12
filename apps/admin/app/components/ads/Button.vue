<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import type { ClassValue } from 'clsx'
import { cn } from '~/lib/cn'

type Appearance = 'brass' | 'default' | 'primary' | 'soft' | 'subtle' | 'outline' | 'outline-danger' | 'link' | 'danger' | 'soft-danger'

// Renders the Leezil `.btn` family (see assets/css/leezil.css). Accepts both the
// native `appearance` prop and the older `color`/`variant`/`size`/`label`/`icon`
// props the page templates use.
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
// design/ has: .btn (default), -primary, -brass, -danger (white, danger text), -ghost.
const MAP: Record<Appearance, string> = {
  brass: 'btn-brass', default: '', outline: '', soft: '', primary: 'btn-primary', subtle: 'btn-ghost', link: 'btn-ghost',
  danger: 'btn-danger', 'outline-danger': 'btn-danger', 'soft-danger': 'btn-danger'
}
const small = computed(() => ['xs', '2xs', 'sm'].includes(props.size ?? ''))
const classes = computed(() => props.square
  ? cn('icon-btn', resolved.value === 'subtle' && 'plain', small.value && 'sm', props.class)
  : cn('btn', MAP[resolved.value], small.value && 'btn-sm', props.block && 'btn-block', props.class))
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
