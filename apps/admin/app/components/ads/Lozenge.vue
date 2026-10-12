<script setup lang="ts">
import { cn } from '~/lib/cn'

export type LozengeAppearance = 'neutral' | 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'teal' | 'magenta' | 'lime'

// Status badge: the design's `.pill` family. Appearances map onto its palettes:
// warn (new/low), ok (confirmed), mist (shipping), teal (delivered), danger
// (returned/out), brass (vip), ivory (newcust). Pass `tone` to use a design
// class directly (e.g. tone="contacted", tone="outline").
const SUBTLE: Record<LozengeAppearance, string> = {
  neutral: 'neutral', blue: 'shipping', green: 'confirmed', red: 'returned', yellow: 'new',
  orange: 'low', purple: 'shipping', teal: 'shipping', magenta: 'returned', lime: 'confirmed'
}
const BOLD: Record<LozengeAppearance, string> = {
  neutral: 'newcust', blue: 'delivered', green: 'delivered', red: 'returned', yellow: 'vip',
  orange: 'vip', purple: 'delivered', teal: 'delivered', magenta: 'returned', lime: 'delivered'
}

const props = withDefaults(defineProps<{ appearance?: LozengeAppearance; bold?: boolean; tone?: string; class?: string }>(), { appearance: 'neutral' })
const classes = computed(() => cn('pill', props.tone ?? (props.bold ? BOLD[props.appearance] : SUBTLE[props.appearance]), props.class))
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
