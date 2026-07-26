<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Trove catalog — a light cream header band (never dark), a sticky
// trove-card sidebar (search + category filters), and a circle-on-sharp-
// frame product grid.
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
    <div class="border-b border-neutral-200 bg-[var(--color-trove-cream)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-[var(--color-trove-teal)]">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Shop</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-trove-ink)] sm:text-5xl">The trove</h1>
        <p class="mt-2 max-w-xl text-neutral-600">Every find, in one place. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- The only template in the system with a RIGHT-side filter sidebar:
           product grid comes first in both DOM order and visual order, the
           filter panel trails it on desktop. -->
      <div class="flex flex-col gap-8 lg:flex-row">
        <div class="min-w-0 flex-1">
          <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-search-x" title="No products found" description="Try a different search or clear your filters.">
            <TroveButton to="/catalog" class="mt-4">Clear filters</TroveButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center rounded text-sm font-bold transition-colors"
                :class="p === props.currentPage ? 'bg-primary-500 text-[var(--color-trove-ink)]' : 'bg-white text-neutral-600 hover:bg-primary-50'"
                @click="props.onUpdateQuery({ page: p })"
              >
                {{ p }}
              </button>
            </div>
          </template>
        </div>

        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="trove-card sticky top-24 space-y-6 p-5">
            <div>
              <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Search</h3>
              <form @submit.prevent="props.onSearchSubmit">
                <TroveInput :model-value="props.searchInput" placeholder="Search…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
              </form>
            </div>
            <div class="h-px bg-neutral-100" />
            <div>
              <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Categories</h3>
              <div class="space-y-1">
                <button
                  v-for="opt in props.categoryOptions"
                  :key="opt.value"
                  class="flex w-full items-center justify-between rounded px-4 py-2 text-sm font-medium transition-all"
                  :class="activeCategory === opt.value ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'"
                  @click="props.onUpdateQuery({ category: opt.value })"
                >
                  <span>{{ opt.label }}</span>
                  <Icon v-if="activeCategory === opt.value" name="i-lucide-check" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>
