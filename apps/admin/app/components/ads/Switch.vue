<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ default: false })
defineProps<{ ariaLabel?: string; label?: string; description?: string; disabled?: boolean; loading?: boolean; class?: string }>()
</script>

<template>
  <label class="inline-flex items-start gap-2" :class="$props.class">
    <SwitchRoot
      v-model="model"
      :aria-label="ariaLabel ?? label"
      :disabled="disabled || loading"
      class="relative mt-0.5 inline-flex h-4 w-8 shrink-0 items-center rounded-full bg-ads-input transition-colors disabled:opacity-50 data-[state=checked]:bg-ads-primary"
    >
      <SwitchThumb class="block size-3 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]" />
    </SwitchRoot>
    <span v-if="label || description" class="min-w-0">
      <span v-if="label" class="block text-sm text-ads-text">{{ label }}</span>
      <span v-if="description" class="block text-xs text-ads-subtlest">{{ description }}</span>
    </span>
  </label>
</template>
