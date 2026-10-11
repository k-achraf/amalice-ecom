<script setup lang="ts">
// Label + control + help/error text. The label wraps the slot so clicking it
// focuses the control without needing ids.
defineProps<{ label: string; help?: string; error?: string; required?: boolean }>()
</script>

<template>
  <label class="block space-y-1">
    <span class="block text-xs font-semibold text-ads-subtle">
      {{ label }}<span v-if="required" class="ms-0.5 text-ads-danger" aria-hidden="true">*</span>
    </span>
    <slot />
    <span v-if="error" class="block text-xs text-ads-danger">{{ error }}</span>
    <span v-else-if="help" class="block text-xs text-ads-subtlest">{{ help }}</span>
  </label>
</template>
