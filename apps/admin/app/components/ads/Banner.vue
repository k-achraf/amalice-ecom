<script setup lang="ts">
import { Info, TriangleAlert } from 'lucide-vue-next'

// The design's `.notice` (ok tint), `.warn` and `.danger` variants.
withDefaults(defineProps<{ tone?: 'info' | 'warning' | 'danger' }>(), { tone: 'info' })
</script>

<template>
  <div class="notice" :class="{ warn: tone === 'warning', danger: tone === 'danger' }">
    <TriangleAlert v-if="tone !== 'info'" class="i" />
    <Info v-else class="i" />
    <div class="grow"><slot /></div>
  </div>
</template>
