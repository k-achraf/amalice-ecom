<script setup lang="ts">
import { cn } from '~/lib/cn'

export type LozengeAppearance = 'neutral' | 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'purple' | 'teal' | 'magenta' | 'lime'

// Atlassian "subtle" lozenges are tinted bg + dark text; "bold" are solid fills.
// Literal class strings (not interpolated) so the Tailwind scanner sees them.
const SUBTLE: Record<LozengeAppearance, string> = {
  neutral: 'bg-[#091e420f] text-[#44546f] dark:bg-[#a1bdd914] dark:text-[#b6c2cf]',
  blue: 'bg-[#e9f2ff] text-[#0055cc] dark:bg-[#1c2b41] dark:text-[#85b8ff]',
  green: 'bg-[#dcfff1] text-[#216e4e] dark:bg-[#1c3329] dark:text-[#7ee2b8]',
  red: 'bg-[#ffecee] text-[#ae2e24] dark:bg-[#42221f] dark:text-[#ff9c8f]',
  yellow: 'bg-[#fff7d6] text-[#7f5f01] dark:bg-[#3d2e00] dark:text-[#f5cd47]',
  orange: 'bg-[#fff3eb] text-[#a54800] dark:bg-[#38291e] dark:text-[#fca700]',
  purple: 'bg-[#f3f0ff] text-[#5e4db2] dark:bg-[#2b273f] dark:text-[#b8acf6]',
  teal: 'bg-[#e7f9ff] text-[#206a83] dark:bg-[#1e3137] dark:text-[#6cc3e0]',
  magenta: 'bg-[#ffecf8] text-[#943d73] dark:bg-[#3d2232] dark:text-[#e774bb]',
  lime: 'bg-[#efffd6] text-[#4c6b1f] dark:bg-[#28311b] dark:text-[#b3df72]'
}
const BOLD: Record<LozengeAppearance, string> = {
  neutral: 'bg-[#44546f] text-white dark:bg-[#b6c2cf] dark:text-[#1d2125]',
  blue: 'bg-[#0c66e4] text-white dark:bg-[#579dff] dark:text-[#1d2125]',
  green: 'bg-[#1f845a] text-white dark:bg-[#4bce97] dark:text-[#1d2125]',
  red: 'bg-[#c9372c] text-white dark:bg-[#f87168] dark:text-[#1d2125]',
  yellow: 'bg-[#f5cd47] text-[#172b4d]',
  orange: 'bg-[#e56910] text-white dark:bg-[#fca700] dark:text-[#1d2125]',
  purple: 'bg-[#6e5dc6] text-white dark:bg-[#9f8fef] dark:text-[#1d2125]',
  teal: 'bg-[#227d9b] text-white dark:bg-[#6cc3e0] dark:text-[#1d2125]',
  magenta: 'bg-[#ae4787] text-white dark:bg-[#e774bb] dark:text-[#1d2125]',
  lime: 'bg-[#5b7f24] text-white dark:bg-[#94c748] dark:text-[#1d2125]'
}

const props = withDefaults(defineProps<{ appearance?: LozengeAppearance; bold?: boolean; class?: string }>(), { appearance: 'neutral' })
const classes = computed(() => cn(
  'inline-flex h-4 max-w-full items-center rounded-ads px-1 text-[11px] font-bold uppercase leading-4 tracking-wide whitespace-nowrap',
  props.bold ? BOLD[props.appearance] : SUBTLE[props.appearance],
  props.class
))
</script>

<template>
  <span :class="classes"><span class="truncate"><slot /></span></span>
</template>
