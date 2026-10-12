<script setup lang="ts">
import { Search } from 'lucide-vue-next'

// The design's `.search` (use `soft` inside cards).
defineOptions({ inheritAttrs: false })
const model = defineModel<string>()
defineProps<{ placeholder?: string; soft?: boolean; label?: string }>()
</script>

<template>
  <label class="search" :class="{ soft }">
    <Search class="i" />
    <span class="sr">{{ label ?? placeholder ?? 'Search' }}</span>
    <input v-bind="$attrs" v-model="model" type="search" :placeholder="placeholder">
  </label>
</template>
