<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Editorial catalog — full-bleed magazine header, inline filter chips, 3-col
// grid (denser, image-forward). Distinct from minimal's top-bar + 4-col grid.
const props = defineProps<{
  data: ProductListResponse | null
  pending: boolean
  categories: Category[] | null
  categoryOptions: { label: string; value: string }[]
  searchInput: string
  routeQuery: Record<string, string | undefined>
  totalPages: number
  currentPage: number
  onSearchSubmit: () => void
  onUpdateSearchInput: (v: string) => void
  onUpdateQuery: (patch: Record<string, string | number | undefined>) => void
}>()
</script>

<template>
  <div>
    <!-- Full-bleed magazine masthead -->
    <div class="border-b-2 border-highlighted bg-default">
      <div class="mx-auto max-w-6xl px-4 py-12 text-center sm:py-16">
        <p class="mb-3 kicker">The Catalog</p>
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">All Products</h1>
        <p class="mx-auto mt-3 max-w-lg text-muted">The full edit. Cash on delivery — pay when it lands.</p>
      </div>
    </div>

    <!-- Inline filter chips bar -->
    <div class="sticky top-16 z-10 border-b border-default bg-default/90 backdrop-blur-sm">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <form class="flex flex-1 gap-2" @submit.prevent="props.onSearchSubmit">
          <EditorialInput :model-value="props.searchInput" placeholder="Search the edit…" icon="i-lucide-search" class="max-w-xs" @update:model-value="props.onUpdateSearchInput" />
        </form>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in props.categoryOptions"
            :key="opt.value"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="(props.routeQuery.category || 'all') === opt.value ? 'border-highlighted bg-highlighted text-inverted' : 'border-default text-muted hover:text-highlighted'"
            @click="props.onUpdateQuery({ category: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div v-if="props.pending" class="py-24 text-center text-muted">Loading…</div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="Nothing matches" description="Try a different search or clear your filters." />
      <template v-else>
        <!-- Magazine 3-col grid -->
        <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-14 flex items-center justify-center gap-1">
          <EditorialButton v-for="p in props.totalPages" :key="p" :variant="p === props.currentPage ? 'solid' : 'ghost'" color="neutral" size="sm" square class="tabular" @click="props.onUpdateQuery({ page: p })">{{ p }}</EditorialButton>
        </div>
      </template>
    </section>
  </div>
</template>
