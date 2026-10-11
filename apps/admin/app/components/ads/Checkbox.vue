<script setup lang="ts">
// Native checkbox, styled by the design's global `input[type=checkbox]` rule
// (18px, teal accent). Supports an indeterminate state.
const model = defineModel<boolean | 'indeterminate'>()
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; class?: string }>()

const el = ref<HTMLInputElement>()
watchEffect(() => { if (el.value) el.value.indeterminate = model.value === 'indeterminate' })
function onChange(e: Event) { model.value = (e.target as HTMLInputElement).checked }
</script>

<template>
  <label class="inline-flex items-start gap-2" :class="$props.class">
    <input ref="el" type="checkbox" class="mt-px" :checked="model === true" :disabled="disabled" :aria-label="ariaLabel ?? label" @change="onChange">
    <span v-if="label || description" class="min-w-0">
      <span v-if="label" class="block text-sm">{{ label }}</span>
      <span v-if="description" class="muted block">{{ description }}</span>
    </span>
  </label>
</template>
