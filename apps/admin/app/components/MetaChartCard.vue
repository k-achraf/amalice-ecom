<script setup lang="ts">
// A titled card around one chart, with an optional "Table" view of the same data
// (the accessible alternative to the plot) and a slot for controls in the header.
defineProps<{
  title: string
  subtitle?: string
  table?: { columns: string[]; rows: (string | number)[][] }
  empty?: boolean
  emptyText?: string
}>()
const view = ref<'chart' | 'table'>('chart')
</script>

<template>
  <section class="card" :aria-label="title" style="gap: 12px; min-width: 0">
    <div class="card-head" style="align-items: flex-start; flex-wrap: wrap; gap: 8px">
      <div style="min-width: 0">
        <h2>{{ title }}</h2>
        <p v-if="subtitle" class="muted" style="font-size: 13px; margin-top: 2px">{{ subtitle }}</p>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
        <slot name="controls" />
        <div v-if="table && !empty" class="chips" role="tablist" aria-label="View" style="flex-grow: 0">
          <button type="button" role="tab" class="chip-btn" style="min-height: 28px" :aria-selected="view === 'chart'" @click="view = 'chart'">Chart</button>
          <button type="button" role="tab" class="chip-btn" style="min-height: 28px" :aria-selected="view === 'table'" @click="view = 'table'">Table</button>
        </div>
      </div>
    </div>
    <p v-if="empty" class="muted" style="padding: 24px 0; text-align: center">{{ emptyText ?? 'No data for this period.' }}</p>
    <div v-else-if="view === 'table' && table" class="table-wrap" style="max-height: 320px; overflow: auto">
      <table style="min-width: 0">
        <thead><tr><th v-for="(c, i) in table.columns" :key="c" :class="{ num: i > 0 }">{{ c }}</th></tr></thead>
        <tbody>
          <tr v-for="(r, ri) in table.rows" :key="ri"><td v-for="(c, ci) in r" :key="ci" :class="{ num: ci > 0 }">{{ c }}</td></tr>
        </tbody>
      </table>
    </div>
    <slot v-else />
  </section>
</template>
