<script setup lang="ts">
// The design's `.field`: label, control, hint. `description` sits under the label,
// `help` under the control.
defineProps<{ label?: string; description?: string; help?: string; error?: string | boolean; required?: boolean; name?: string; class?: string }>()
</script>

<template>
  <div class="field" :class="$props.class">
    <span v-if="label" class="label">{{ label }}<span v-if="required" style="color: var(--danger); margin-left: 2px" aria-hidden="true">*</span></span>
    <span v-if="description" class="hint" style="margin-top: -4px">{{ description }}</span>
    <slot />
    <span v-if="typeof error === 'string' && error" class="hint" style="color: var(--danger-fg)">{{ error }}</span>
    <span v-else-if="help" class="hint">{{ help }}</span>
  </div>
</template>
