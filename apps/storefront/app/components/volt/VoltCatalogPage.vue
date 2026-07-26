<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Volt catalog — sticky hairline-bordered sidebar (search + category
// filters) + grid. No @nuxt/ui.
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
    <div class="volt-grid-bg border-b border-white/10 bg-black">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="font-mono-spec mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">Shop</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl">Shop all products</h1>
        <span class="volt-rule mt-3" />
        <p class="mt-3 max-w-xl text-white/50">Browse the full edit. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="sticky top-24 space-y-6 rounded-md border border-white/10 bg-[#0c1113] p-5">
            <div>
              <h3 class="font-mono-spec mb-3 text-[11px] uppercase tracking-wide text-white/40">Search</h3>
              <form @submit.prevent="props.onSearchSubmit">
                <VoltInput :model-value="props.searchInput" placeholder="Search products…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
              </form>
            </div>
            <div class="h-px bg-white/10" />
            <div>
              <h3 class="font-mono-spec mb-3 text-[11px] uppercase tracking-wide text-white/40">Categories</h3>
              <div class="space-y-1">
                <button
                  v-for="opt in props.categoryOptions"
                  :key="opt.value"
                  class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-all"
                  :class="activeCategory === opt.value ? 'border-primary-400/40 bg-primary-400/5 text-primary-400' : 'border-transparent text-white/60 hover:border-white/10 hover:text-white'"
                  @click="props.onUpdateQuery({ category: opt.value })"
                >
                  <span>{{ opt.label }}</span>
                  <Icon v-if="activeCategory === opt.value" name="i-lucide-check" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <div v-if="props.pending" class="flex items-center justify-center py-24 text-white/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products found" description="Try a different search or clear your filters.">
            <VoltButton to="/catalog" class="mt-4">Clear filters</VoltButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="font-mono-spec flex size-9 items-center justify-center rounded-md border text-sm transition-colors"
                :class="p === props.currentPage ? 'border-primary-400/50 bg-primary-400/10 text-primary-400' : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'"
                @click="props.onUpdateQuery({ page: p })"
              >
                {{ p }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
