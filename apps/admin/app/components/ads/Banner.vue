<script setup lang="ts">
import { Info, TriangleAlert } from 'lucide-vue-next'

// Inline notice: `info` (neutral/blue) or `warning` (red) — Atlassian section message.
withDefaults(defineProps<{ tone?: 'info' | 'warning' }>(), { tone: 'info' })
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-ads-lg border-s-4 p-4 text-sm"
    :class="tone === 'warning' ? 'border-ads-danger bg-[#ffecee] text-[#5d1f1a] dark:bg-[#42221f] dark:text-[#ffd5d2]' : 'border-ads-primary bg-ads-selected text-ads-text'"
  >
    <TriangleAlert v-if="tone === 'warning'" class="mt-0.5 size-4 shrink-0 text-ads-danger" />
    <Info v-else class="mt-0.5 size-4 shrink-0 text-ads-primary" />
    <div class="min-w-0"><slot /></div>
  </div>
</template>
