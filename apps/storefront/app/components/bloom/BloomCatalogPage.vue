<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Bloom catalog — NO sidebar anywhere in Bloom. A soft gradient header band
// with a centered search pill, then a centered row of pill filter chips,
// then an airy 3-col grid. Soft/generous spacing throughout.
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
    <div class="bg-gradient-to-br from-[var(--color-bloom-hero-from)] to-[var(--color-bloom-hero-to)]">
      <div class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-bloom-ink)]">Shop</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-bloom-ink)] sm:text-5xl">All products</h1>
        <p class="mx-auto mt-2 max-w-xl text-neutral-600">Every essential, in one place. Cash on delivery — pay when it lands at your door.</p>
        <form class="mx-auto mt-6 max-w-md" @submit.prevent="props.onSearchSubmit">
          <BloomInput :model-value="props.searchInput" placeholder="Search for glow…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
        </form>
      </div>
    </div>

    <!-- Centered pill filter-chip row — no sidebar -->
    <div class="border-b border-neutral-100 bg-white/70">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-5 sm:px-6 lg:px-8">
        <button
          v-for="opt in props.categoryOptions"
          :key="opt.value"
          class="rounded-full px-4 py-2 text-sm font-medium transition-all"
          :class="activeCategory === opt.value ? 'bg-primary-500 text-white shadow-[var(--shadow-bloom-sm)]' : 'bg-white text-neutral-600 shadow-[var(--shadow-bloom-sm)] hover:text-primary-600'"
          @click="props.onUpdateQuery({ category: opt.value })"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-search-x" title="No products found" description="Try a different search or clear your filters.">
        <BloomButton to="/catalog" class="mt-4">Clear filters</BloomButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-14 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors"
            :class="p === props.currentPage ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 hover:bg-primary-50'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
