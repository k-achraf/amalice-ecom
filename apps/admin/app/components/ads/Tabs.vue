<script setup lang="ts">
// Filter chips (the design's `.chips` / `.chip-btn` tabs). Tab strip only:
// callers render the active panel themselves (v-if on the model).
const model = defineModel<string>()
defineProps<{ items: { label: string; value: string; icon?: string; count?: number }[]; plain?: boolean }>()
</script>

<template>
  <div class="chips" :class="{ plain }" role="tablist">
    <button
      v-for="t in items"
      :key="t.value"
      type="button"
      role="tab"
      class="chip-btn"
      :aria-selected="t.value === model"
      @click="model = t.value"
    >
      <AdsIcon v-if="t.icon" :name="t.icon" />
      {{ t.label }}
      <span v-if="t.count != null" class="count">{{ t.count }}</span>
    </button>
  </div>
</template>
