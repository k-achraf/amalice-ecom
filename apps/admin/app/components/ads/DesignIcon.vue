<script setup lang="ts">
import { DESIGN_ICONS } from '~/lib/design-icons'

// An icon from the design's own set (primary navigation, tab bar).
defineProps<{ name: string }>()
</script>

<template>
  <svg class="i" viewBox="0 0 24 24" aria-hidden="true" v-html="DESIGN_ICONS[name] ?? ''" />
</template>
