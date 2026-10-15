<script setup lang="ts">
// Tab strip only: callers render the active panel themselves (v-if on the model).
// Default = the design's segmented filter chips (`.chips`); `underline` = the
// underline `.tabs` used on edit pages.
const model = defineModel<string>()
defineProps<{ items: { label: string; value: string; icon?: string; count?: number }[]; underline?: boolean; plain?: boolean }>()
</script>

<template>
  <div v-if="underline" class="tabs" role="tablist">
    <button v-for="t in items" :key="t.value" type="button" role="tab" :aria-selected="t.value === model" @click="model = t.value">
      {{ t.label }}<span v-if="t.count != null" class="muted"> {{ t.count }}</span>
    </button>
  </div>
  <div v-else class="chips" role="tablist">
    <button v-for="t in items" :key="t.value" type="button" role="tab" class="chip-btn" :aria-selected="t.value === model" @click="model = t.value">
      <AdsIcon v-if="t.icon" :name="t.icon" style="width: 16px; height: 16px" />
      {{ t.label }}
      <span v-if="t.count != null" class="count">{{ t.count }}</span>
    </button>
  </div>
</template>
