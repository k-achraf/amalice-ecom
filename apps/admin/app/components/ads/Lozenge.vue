<script setup lang="ts">
import { cn } from '~/lib/cn'

export type LozengeAppearance = 'neutral' | 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'teal' | 'magenta' | 'lime'

// Status pill: the Leezil `.pill` family. Appearances map onto the design's
// palettes: warn (new/low), ok (confirmed), mist (shipping), teal (delivered),
// danger (returned/out), brass (vip), ivory (neutral).
const SUBTLE: Record<LozengeAppearance, string> = {
  neutral: 'newcust', blue: 'shipping', green: 'confirmed', red: 'returned', yellow: 'new',
  orange: 'low', purple: 'shipping', teal: 'shipping', magenta: 'returned', lime: 'confirmed'
}
const BOLD: Record<LozengeAppearance, string> = {
  neutral: 'shipping', blue: 'delivered', green: 'delivered', red: 'solid-danger', yellow: 'vip',
  orange: 'vip', purple: 'delivered', teal: 'delivered', magenta: 'solid-danger', lime: 'delivered'
}

const props = withDefaults(defineProps<{ appearance?: LozengeAppearance; bold?: boolean; class?: string }>(), { appearance: 'neutral' })
const classes = computed(() => cn('pill', props.bold ? BOLD[props.appearance] : SUBTLE[props.appearance], props.class))
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
