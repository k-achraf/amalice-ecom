<script setup lang="ts">
import { Circle } from 'lucide-vue-next'
import { ICONS } from '~/lib/icons'

// Accepts the `i-lucide-<name>` form used throughout the admin templates (and
// bare `<name>`), resolved against the generated map in lib/icons.ts.
const props = defineProps<{ name: string }>()
const icon = computed(() => ICONS[props.name.replace(/^i-lucide-/, '').replace(/^lucide:/, '')] ?? Circle)
</script>

<template>
  <component :is="icon" aria-hidden="true" />
</template>
