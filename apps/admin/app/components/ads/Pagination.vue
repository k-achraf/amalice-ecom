<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

// Server-side pagination bar: one-way `page`, emits update:page / update:pageSize
// for the parent to refetch (never two-way binds a route-derived computed).
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

// 1 … 4 5 [6] 7 8 … 20
const pages = computed<(number | '…')[]>(() => {
  const last = pageCount.value
  const cur = props.page
  const set = new Set([1, last, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= last))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('…')
    out.push(n)
  })
  return out
})

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.total, props.page * props.pageSize))
</script>

<template>
  <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3">
    <p class="ads-tabular text-sm text-ads-subtle">{{ from }}–{{ to }} of {{ total }} {{ itemLabel }}</p>
    <div class="flex items-center gap-3">
      <AdsSelect
        :model-value="pageSize"
        :options="sizeOptions"
        class="w-28"
        @update:model-value="(v) => emit('update:pageSize', Number(v))"
      />
      <nav class="flex items-center gap-0.5" aria-label="Pagination">
        <AdsButton appearance="subtle" square aria-label="Previous page" :disabled="page <= 1" @click="emit('update:page', page - 1)"><ChevronLeft /></AdsButton>
        <template v-for="(p, i) in pages" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="px-1 text-ads-subtlest">…</span>
          <button
            v-else
            type="button"
            :aria-current="p === page ? 'page' : undefined"
            class="ads-tabular h-8 min-w-8 rounded-ads px-2 text-sm font-medium"
            :class="p === page ? 'bg-ads-selected text-ads-primary' : 'text-ads-subtle hover:bg-ads-hover'"
            @click="emit('update:page', p)"
          >{{ p }}</button>
        </template>
        <AdsButton appearance="subtle" square aria-label="Next page" :disabled="page >= pageCount" @click="emit('update:page', page + 1)"><ChevronRight /></AdsButton>
      </nav>
    </div>
  </div>
</template>
