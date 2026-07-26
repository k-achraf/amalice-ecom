<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Drop catalog — NO sidebar. A black top filter bar (search + category
// toggle row) sits under a tight masthead, then a dense 3-col grid. Tight/
// aggressive spacing, all on the black surface, no shadow anywhere.
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
  <div class="bg-black">
    <div class="border-b border-white/10 bg-[#171717]">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white">Shop</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl">Shop the full drop</h1>
      </div>
    </div>

    <!-- Black top filter bar -->
    <div class="sticky top-0 z-10 border-b border-white/10 bg-black">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <form class="w-full lg:max-w-xs" @submit.prevent="props.onSearchSubmit">
          <DropInput :model-value="props.searchInput" placeholder="Search products…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
        </form>
        <div class="flex flex-1 flex-wrap gap-2 overflow-x-auto">
          <button
            v-for="opt in props.categoryOptions"
            :key="opt.value"
            class="shrink-0 border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
            :class="activeCategory === opt.value ? 'border-primary-500 bg-primary-500 text-black' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'"
            @click="props.onUpdateQuery({ category: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-white/40">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products found" description="Try a different search or clear your filters.">
        <DropButton to="/catalog" class="mt-4">Clear filters</DropButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3">
          <div v-for="product in props.data.items" :key="product.id" class="bg-black">
            <TemplateSection name="ProductCard" :section-props="{ product }" />
          </div>
        </div>
        <div v-if="props.totalPages > 1" class="mt-10 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center border text-sm font-bold transition-colors"
            :class="p === props.currentPage ? 'border-primary-500 bg-primary-500 text-black' : 'border-white/10 text-white hover:border-primary-500'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
