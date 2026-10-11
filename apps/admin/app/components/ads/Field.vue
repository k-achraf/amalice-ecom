<script setup lang="ts">
// Label + control + help/error text. The label wraps the slot so clicking it
// focuses the control without ids.
defineProps<{ label?: string; description?: string; help?: string; error?: string | boolean; required?: boolean; name?: string; class?: string }>()
</script>

<template>
  <label class="field" :class="$props.class">
    <span v-if="label" class="field-label">{{ label }}<span v-if="required" class="ms-0.5" style="color: var(--danger)" aria-hidden="true">*</span></span>
    <span v-if="description" class="field-desc">{{ description }}</span>
    <slot />
    <span v-if="typeof error === 'string' && error" class="field-error">{{ error }}</span>
    <span v-else-if="help" class="field-help">{{ help }}</span>
  </label>
</template>
