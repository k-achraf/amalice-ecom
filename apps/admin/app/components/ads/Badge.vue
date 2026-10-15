<script setup lang="ts">
import type { LozengeAppearance } from './Lozenge.vue'

// Nuxt-UI-style badge API (`color`/`variant`/`label`) rendered as an Atlassian lozenge.
const props = defineProps<{ color?: string; variant?: string; size?: string; label?: string; class?: string }>()

const MAP: Record<string, LozengeAppearance> = {
  primary: 'blue', info: 'blue', neutral: 'neutral', error: 'red', success: 'green', warning: 'yellow', secondary: 'purple'
}
const appearance = computed(() => MAP[props.color ?? 'primary'] ?? 'neutral')
</script>

<template>
  <AdsLozenge :appearance="appearance" :bold="variant === 'solid'" :class="props.class"><slot>{{ label }}</slot></AdsLozenge>
</template>
