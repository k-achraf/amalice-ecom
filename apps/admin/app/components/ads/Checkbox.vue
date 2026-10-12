<script setup lang="ts">
// The design's `.check`: native checkbox (16px, teal accent) + label + optional sub text.
// Supports an indeterminate state.
const model = defineModel<boolean | 'indeterminate'>()
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; class?: string }>()

const el = ref<HTMLInputElement>()
watchEffect(() => { if (el.value) el.value.indeterminate = model.value === 'indeterminate' })
function onChange(e: Event) { model.value = (e.target as HTMLInputElement).checked }
</script>

<template>
  <label class="check" :class="$props.class">
    <input ref="el" type="checkbox" :checked="model === true" :disabled="disabled" :aria-label="ariaLabel ?? label" @change="onChange">
    <span v-if="label || description"><template v-if="label">{{ label }}</template><span v-if="description" class="sub">{{ description }}</span></span>
  </label>
</template>
