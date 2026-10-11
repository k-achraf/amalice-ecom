<script setup lang="ts">
import { SwitchRoot } from 'reka-ui'

const model = defineModel<boolean>({ default: false })
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; loading?: boolean; class?: string }>()
</script>

<template>
  <label class="inline-flex items-start gap-3" :class="$props.class">
    <SwitchRoot v-model="model" class="switch" :aria-label="ariaLabel ?? label" :disabled="disabled || loading"><span /></SwitchRoot>
    <span v-if="label || description" class="min-w-0">
      <span v-if="label" class="block text-sm">{{ label }}</span>
      <span v-if="description" class="muted block">{{ description }}</span>
    </span>
  </label>
</template>
