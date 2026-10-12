<script setup lang="ts">
// The design's `.table-foot`: "Showing x-y of N" on the left, Previous / Next on the
// right. Server-side: one-way `page`, emits update:page / update:pageSize for the
// parent to refetch (never two-way binds a route-derived computed).
const props = withDefaults(defineProps<{
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  itemLabel?: string
}>(), { pageSizeOptions: () => [10, 20, 50, 100], itemLabel: 'items' })

const emit = defineEmits<{ 'update:page': [page: number]; 'update:pageSize': [size: number] }>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const sizeOptions = computed(() => props.pageSizeOptions.map((n) => ({ label: `${n} / page`, value: n })))
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.total, props.page * props.pageSize))
</script>

<template>
  <div v-if="total > 0" class="table-foot">
    <span class="mono">Showing {{ from }}–{{ to }} of {{ total }} {{ itemLabel }} · page {{ page }} of {{ pageCount }}</span>
    <AdsSelect :model-value="pageSize" :options="sizeOptions" size="sm" style="width: 110px" @update:model-value="(v) => emit('update:pageSize', Number(v))" />
    <button class="btn btn-sm" type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">Previous</button>
    <button class="btn btn-sm" type="button" :disabled="page >= pageCount" @click="emit('update:page', page + 1)">Next</button>
  </div>
</template>
