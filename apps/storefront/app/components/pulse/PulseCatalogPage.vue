<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Pulse catalog — a TOP filter bar (inline search + pill category chips),
// no sidebar, 3-col grid on the white surface.
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

const activeCategory = computed(() => props.routeQuery.category || 'all')
</script>

<template>
  <div>
    <div class="mesh-bg border-b border-neutral-100">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Shop</span>
        </nav>
        <h1 class="font-display text-4xl text-neutral-900 sm:text-5xl">All products</h1>
        <p class="mt-2 max-w-xl text-neutral-500">Every gadget, in one place. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <!-- Top filter bar — inline search + pill category chips, no sidebar -->
    <div class="border-b border-neutral-100 bg-white/95 backdrop-blur-sm">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <form class="w-full sm:max-w-xs" @submit.prevent="props.onSearchSubmit">
          <PulseInput :model-value="props.searchInput" placeholder="Search…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
        </form>
        <div class="flex flex-1 flex-wrap gap-2 overflow-x-auto">
          <button
            v-for="opt in props.categoryOptions"
            :key="opt.value"
            class="spec-chip shrink-0 !px-4 !py-1.5 !text-xs transition-all"
            :class="activeCategory === opt.value ? '!bg-primary-500 !text-white' : 'hover:!bg-primary-100'"
            @click="props.onUpdateQuery({ category: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-search-x" title="No products found" description="Try a different search or clear your filters.">
        <PulseButton to="/catalog" class="mt-4">Clear filters</PulseButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors"
            :class="p === props.currentPage ? 'bg-primary-500 text-white shadow-[var(--shadow-pulse-sm)]' : 'bg-white text-neutral-600 hover:bg-primary-50'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
