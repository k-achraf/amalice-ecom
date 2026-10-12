<script setup lang="ts">
const model = defineModel<string | undefined>()
withDefaults(defineProps<{ options?: { label: string; value: string; description?: string }[]; items?: { label: string; value: string; description?: string }[]; orientation?: 'horizontal' | 'vertical' }>(), { orientation: 'horizontal' })
const name = `ads-radio-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div role="radiogroup" style="display: flex; flex-wrap: wrap; gap: 8px 20px" :style="orientation === 'vertical' ? 'flex-direction: column' : undefined">
    <label v-for="o in (options ?? items ?? [])" :key="o.value" class="check">
      <input v-model="model" type="radio" :name="name" :value="o.value">
      <span>{{ o.label }}<span v-if="o.description" class="sub">{{ o.description }}</span></span>
    </label>
  </div>
</template>
