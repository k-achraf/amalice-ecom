<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Forge catalog — sticky bordered sidebar (search + category filters) +
// grid. No @nuxt/ui.
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
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-primary-500">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-forge-ink)]/60">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-[var(--color-forge-ink)]">Shop</span>
        </nav>
        <h1 class="font-display text-3xl uppercase sm:text-4xl">Shop all products</h1>
        <p class="mt-2 max-w-xl font-medium text-[var(--color-forge-ink)]/70">Browse the full stock list. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- TOP industrial filter bar — bordered, divided sections with
           monospace labels, no sidebar. Product grid runs full-width below. -->
      <div class="mb-8 flex flex-col border-[3px] border-[var(--color-forge-ink)] bg-white sm:flex-row sm:divide-x-[3px] sm:divide-[var(--color-forge-ink)]">
        <div class="border-b-[3px] border-[var(--color-forge-ink)] p-4 sm:w-72 sm:border-b-0 sm:shrink-0">
          <h3 class="mb-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">// Search</h3>
          <form @submit.prevent="props.onSearchSubmit">
            <ForgeInput :model-value="props.searchInput" placeholder="Search products…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
          </form>
        </div>
        <div class="flex-1 p-4">
          <h3 class="mb-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">// Category</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in props.categoryOptions"
              :key="opt.value"
              class="flex items-center gap-1.5 border-[3px] px-3 py-1.5 text-xs font-bold uppercase transition-all"
              :class="activeCategory === opt.value ? 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)]' : 'border-[var(--color-forge-ink)]/20 text-[var(--color-forge-ink)]/60 hover:border-[var(--color-forge-ink)]'"
              @click="props.onUpdateQuery({ category: opt.value })"
            >
              <span>{{ opt.label }}</span>
              <Icon v-if="activeCategory === opt.value" name="i-lucide-check" class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="props.pending" class="flex items-center justify-center py-24 text-[var(--color-forge-ink)]/40">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products found" description="Try a different search or clear your filters.">
        <ForgeButton to="/catalog" class="mt-4">Clear filters</ForgeButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center border-[3px] border-[var(--color-forge-ink)] text-sm font-bold transition-colors"
            :class="p === props.currentPage ? 'bg-[var(--color-forge-ink)] text-white' : 'bg-white text-[var(--color-forge-ink)] hover:bg-primary-500'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
