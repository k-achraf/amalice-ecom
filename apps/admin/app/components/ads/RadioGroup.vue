<script setup lang="ts">
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from 'reka-ui'

const model = defineModel<string>()
defineProps<{ options: { label: string; value: string }[] }>()
</script>

<template>
  <RadioGroupRoot v-model="model" class="flex flex-wrap gap-4">
    <label v-for="o in options" :key="o.value" class="flex cursor-pointer items-center gap-2 text-sm text-ads-text">
      <RadioGroupItem
        :value="o.value"
        class="flex size-4 items-center justify-center rounded-full border-2 border-ads-input bg-ads-surface data-[state=checked]:border-ads-primary"
      >
        <RadioGroupIndicator class="size-2 rounded-full bg-ads-primary" />
      </RadioGroupItem>
      {{ o.label }}
    </label>
  </RadioGroupRoot>
</template>
