<script setup lang="ts">
// Shared server-side pagination bar — item count, a page-size select, and
// UPagination. Every admin list page (orders/customers/audit-log/
// reconciliation/inventory) uses this instead of hand-rolling its own, after
// a real bug: `v-model:page="someComputed"` combined with an explicit
// `@update:page` handler on the same <UPagination> silently broke page
// clicks everywhere, because `page` here is always a computed derived from
// the URL (`route.query.page`), which has no setter — v-model tries to write
// through it. This component binds `:page` one-way and only ever emits
// `update:page`/`update:pageSize` for the parent to act on (a real server
// refetch with the new page/pageSize), never attempting a two-way bind.
const props = withDefaults(defineProps<{
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  itemLabel?: string
}>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
  itemLabel: 'items'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [pageSize: number]
}>()

const pageSizeItems = computed(() => props.pageSizeOptions.map((n) => ({ label: `${n} / page`, value: n })))
</script>

<template>
  <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-sm text-muted">{{ total }} {{ itemLabel }}</p>
    <div class="flex items-center gap-3">
      <USelect
        :model-value="pageSize"
        :items="pageSizeItems"
        class="w-32"
        @update:model-value="(v) => emit('update:pageSize', Number(v))"
      />
      <UPagination
        :page="page"
        :total="total"
        :items-per-page="pageSize"
        @update:page="(p) => emit('update:page', p)"
      />
    </div>
  </div>
</template>
