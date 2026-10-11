<script setup lang="ts">
import { Circle } from 'lucide-vue-next'
import { ICONS } from '~/lib/icons'

// Accepts the `i-lucide-<name>` form used throughout the templates (and bare
// `<name>`), resolved against the generated map in lib/icons.ts. Rendered at the
// design's icon spec: 20px, 1.6 stroke, round caps (see svg.i in leezil.css).
const props = defineProps<{ name: string }>()
const icon = computed(() => ICONS[props.name.replace(/^i-lucide-/, '').replace(/^lucide:/, '')] ?? Circle)
</script>

<template>
  <component :is="icon" class="i" aria-hidden="true" style="width: 20px; height: 20px" />
</template>
