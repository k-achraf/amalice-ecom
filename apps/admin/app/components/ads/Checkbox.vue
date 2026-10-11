<script setup lang="ts">
import { Check, Minus } from 'lucide-vue-next'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'

const model = defineModel<boolean | 'indeterminate'>()
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; class?: string }>()
</script>

<template>
  <label class="inline-flex items-start gap-2" :class="$props.class">
    <CheckboxRoot
      v-model="model"
      :aria-label="ariaLabel ?? label"
      :disabled="disabled"
      class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-ads-input bg-ads-surface hover:bg-ads-hover disabled:opacity-50 data-[state=checked]:border-ads-primary data-[state=checked]:bg-ads-primary data-[state=indeterminate]:border-ads-primary data-[state=indeterminate]:bg-ads-primary"
    >
      <CheckboxIndicator class="text-white dark:text-[#161a1d]">
        <Minus v-if="model === 'indeterminate'" class="size-3" :stroke-width="3" />
        <Check v-else class="size-3" :stroke-width="3" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span v-if="label || description" class="min-w-0">
      <span v-if="label" class="block text-sm text-ads-text">{{ label }}</span>
      <span v-if="description" class="block text-xs text-ads-subtlest">{{ description }}</span>
    </span>
  </label>
</template>
