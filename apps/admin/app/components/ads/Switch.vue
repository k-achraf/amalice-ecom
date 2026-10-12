<script setup lang="ts">
// The design's rectangular `.switch`, optionally with a label / description beside it.
const model = defineModel<boolean>({ default: false })
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; loading?: boolean; class?: string }>()
</script>

<template>
  <label class="check" :class="$props.class" style="align-items: center">
    <span class="switch">
      <input v-model="model" type="checkbox" :aria-label="ariaLabel ?? label" :disabled="disabled || loading"><span />
    </span>
    <span v-if="label || description"><template v-if="label">{{ label }}</template><span v-if="description" class="sub">{{ description }}</span></span>
  </label>
</template>
