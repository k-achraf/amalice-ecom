<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Nova catalog — NO sidebar. A punchy top filter bar (search + category
// toggle row) sits directly under a tight header band, then a dense 4-col
// grid. Tight/punchy spacing throughout (p-4/gap-4-ish), distinct from
// Atelier/Drop's sidebar layouts.
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
    <div class="border-b-2 border-black bg-primary-500">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-black/60">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-black">Shop</span>
        </nav>
        <h1 class="font-display text-3xl uppercase sm:text-4xl">Shop all products</h1>
      </div>
    </div>

    <!-- Top filter bar — search + category toggles, all in one tight row -->
    <div class="sticky top-0 z-10 border-b-2 border-black bg-white">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <form class="w-full lg:max-w-xs" @submit.prevent="props.onSearchSubmit">
          <NovaInput :model-value="props.searchInput" placeholder="Search products…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
        </form>
        <div class="flex flex-1 flex-wrap gap-2 overflow-x-auto">
          <button
            v-for="opt in props.categoryOptions"
            :key="opt.value"
            class="shrink-0 border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
            :class="activeCategory === opt.value ? 'border-black bg-primary-500 text-black' : 'border-black/20 text-black/60 hover:border-black'"
            @click="props.onUpdateQuery({ category: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-black/40">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <NovaEmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products found" description="Try a different search or clear your filters.">
        <NovaButton to="/catalog" class="mt-4">Clear filters</NovaButton>
      </NovaEmptyState>
      <template v-else>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-10 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center border-2 border-black text-sm font-bold transition-colors"
            :class="p === props.currentPage ? 'bg-black text-white' : 'bg-white text-black hover:bg-primary-500'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
