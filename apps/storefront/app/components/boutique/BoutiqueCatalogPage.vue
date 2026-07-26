<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Boutique catalog — the luxury antithesis of a dense shop grid. A narrow
// centered stage (max-w-5xl), a single quiet eyebrow, a minimal filter row
// (search + one refined select), and a 3-col grid with extreme whitespace.
// No chips, no banners, no color blocks — the restraint reads as premium.
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
  <div class="bg-default">
    <!-- Eyebrow masthead -->
    <header class="mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-32">
      <p class="text-xs uppercase tracking-[0.4em] text-muted">The Collection</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">All Goods</h1>
      <div class="mx-auto mt-8 h-px w-12 bg-default" />
    </header>

    <!-- Minimal filter row: search + a refined select -->
    <div class="mx-auto mt-12 max-w-5xl px-6">
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <form class="w-full max-w-sm" @submit.prevent="props.onSearchSubmit">
          <BoutiqueInput
            :model-value="props.searchInput"
            placeholder="Search…"
            icon="i-lucide-search"
            class="w-full"
            @update:model-value="props.onUpdateSearchInput"
          />
        </form>
        <BoutiqueSelect
          :model-value="props.routeQuery.category || 'all'"
          :items="props.categoryOptions"
          class="w-44 uppercase tracking-widest text-xs"
          @update:model-value="(v: string) => props.onUpdateQuery({ category: v })"
        />
      </div>
    </div>

    <!-- Grid -->
    <section class="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <div v-if="props.pending" class="py-32 text-center text-xs uppercase tracking-[0.3em] text-muted">Loading…</div>
      <EmptyState
        v-else-if="!props.data?.items.length"
        icon="i-lucide-package-search"
        title="Nothing found"
        description="Try another search, or clear your filters."
      />
      <template v-else>
        <div class="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          <TemplateSection
            v-for="product in props.data.items"
            :key="product.id"
            name="ProductCard"
            :section-props="{ product }"
          />
        </div>

        <!-- Refined numbered pagination -->
        <nav v-if="props.totalPages > 1" class="mt-24 flex items-center justify-center gap-3">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="size-9 text-xs tabular transition-colors"
            :class="p === props.currentPage
              ? 'border border-default bg-highlighted text-inverted'
              : 'text-muted hover:text-highlighted'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </nav>
      </template>
    </section>
  </div>
</template>
