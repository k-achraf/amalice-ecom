<script setup lang="ts">
import { Check, Minus } from 'lucide-vue-next'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'

const model = defineModel<boolean | 'indeterminate'>()
defineProps<{ ariaLabel?: string }>()
</script>

<template>
  <CheckboxRoot
    v-model="model"
    :aria-label="ariaLabel"
    class="flex size-4 shrink-0 items-center justify-center rounded-[3px] border-2 border-ads-input bg-ads-surface hover:bg-ads-hover data-[state=checked]:border-ads-primary data-[state=checked]:bg-ads-primary data-[state=indeterminate]:border-ads-primary data-[state=indeterminate]:bg-ads-primary"
  >
    <CheckboxIndicator class="text-white dark:text-[#161a1d]">
      <Minus v-if="model === 'indeterminate'" class="size-3" :stroke-width="3" />
      <Check v-else class="size-3" :stroke-width="3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
