<script setup lang="ts">
// Label + control + help/error text. The label wraps the slot so clicking it
// focuses the control without needing ids. `description` (Nuxt UI naming) sits
// under the label; `help` under the control.
defineProps<{ label?: string; description?: string; help?: string; error?: string | boolean; required?: boolean; name?: string; class?: string }>()
</script>

<template>
  <label class="block space-y-1" :class="$props.class">
    <span v-if="label" class="block text-xs font-semibold text-ads-subtle">
      {{ label }}<span v-if="required" class="ms-0.5 text-ads-danger" aria-hidden="true">*</span>
    </span>
    <span v-if="description" class="block text-xs text-ads-subtlest">{{ description }}</span>
    <slot />
    <span v-if="typeof error === 'string' && error" class="block text-xs text-ads-danger">{{ error }}</span>
    <span v-else-if="help" class="block text-xs text-ads-subtlest">{{ help }}</span>
  </label>
</template>
