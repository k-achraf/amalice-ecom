<script setup lang="ts">
import { cn } from '~/lib/cn'

const model = defineModel<string | number>()
defineProps<{ placeholder?: string; type?: string; class?: string; disabled?: boolean; invalid?: boolean }>()
</script>

<template>
  <div class="relative">
    <span v-if="$slots.icon" class="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ads-subtlest [&_svg]:size-4"><slot name="icon" /></span>
    <input
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :class="cn(
        'h-8 w-full rounded-ads border border-ads-input bg-ads-surface px-2 text-sm text-ads-text placeholder:text-ads-subtlest hover:bg-ads-hover focus:bg-ads-surface disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled aria-[invalid]:border-ads-danger',
        $slots.icon && 'ps-8',
        $props.class
      )"
    >
  </div>
</template>
