<script setup lang="ts">
import { cn } from '~/lib/cn'

const model = defineModel<string>()
defineProps<{ placeholder?: string; rows?: number; class?: string; disabled?: boolean }>()
</script>

<template>
  <textarea
    v-model="model"
    :rows="rows ?? 3"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="cn('w-full rounded-ads border border-ads-input bg-ads-surface px-2 py-1.5 text-sm text-ads-text placeholder:text-ads-subtlest hover:bg-ads-hover focus:bg-ads-surface disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled', $props.class)"
  />
</template>
