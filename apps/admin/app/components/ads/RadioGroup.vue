<script setup lang="ts">
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from 'reka-ui'

const model = defineModel<string | undefined>()
withDefaults(defineProps<{ options?: { label: string; value: string; description?: string }[]; items?: { label: string; value: string; description?: string }[]; orientation?: 'horizontal' | 'vertical' }>(), { orientation: 'horizontal' })
</script>

<template>
  <RadioGroupRoot v-model="model" class="flex flex-wrap gap-x-4 gap-y-2" :class="{ 'flex-col': orientation === 'vertical' }">
    <label v-for="o in (options ?? items ?? [])" :key="o.value" class="flex cursor-pointer items-start gap-2 text-sm text-ads-text">
      <RadioGroupItem
        :value="o.value"
        class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-ads-input bg-ads-surface data-[state=checked]:border-ads-primary"
      >
        <RadioGroupIndicator class="size-2 rounded-full bg-ads-primary" />
      </RadioGroupItem>
      <span>{{ o.label }}<span v-if="o.description" class="block text-xs text-ads-subtlest">{{ o.description }}</span></span>
    </label>
  </RadioGroupRoot>
</template>
