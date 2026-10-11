<script setup lang="ts">
const model = defineModel<string | undefined>()
withDefaults(defineProps<{ options?: { label: string; value: string; description?: string }[]; items?: { label: string; value: string; description?: string }[]; orientation?: 'horizontal' | 'vertical' }>(), { orientation: 'horizontal' })
const name = `ads-radio-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div class="flex flex-wrap gap-x-5 gap-y-2" :class="{ 'flex-col': orientation === 'vertical' }" role="radiogroup">
    <label v-for="o in (options ?? items ?? [])" :key="o.value" class="flex cursor-pointer items-start gap-2 text-sm">
      <input v-model="model" type="radio" :name="name" :value="o.value" class="mt-0.5" style="width: 18px; height: 18px; accent-color: var(--teal)">
      <span>{{ o.label }}<span v-if="o.description" class="muted block">{{ o.description }}</span></span>
    </label>
  </div>
</template>
