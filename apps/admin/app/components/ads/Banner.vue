<script setup lang="ts">
import { Info, TriangleAlert } from 'lucide-vue-next'

// Inline notice: `info` (ok tint) or `warning` (danger tint).
withDefaults(defineProps<{ tone?: 'info' | 'warning' }>(), { tone: 'info' })
</script>

<template>
  <div class="notice" :class="{ danger: tone === 'warning' }">
    <TriangleAlert v-if="tone === 'warning'" class="i" style="width: 20px; height: 20px" />
    <Info v-else class="i" style="width: 20px; height: 20px" />
    <div class="min-w-0"><slot /></div>
  </div>
</template>
