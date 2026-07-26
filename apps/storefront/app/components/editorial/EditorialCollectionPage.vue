<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Editorial collection — full-bleed masthead with the category name in bold
// uppercase, inline price filter, magazine 3-col grid.
const props = defineProps<{
  category: Category | null
  data: ProductListResponse | null
  pending: boolean
  minPrice: number | undefined
  maxPrice: number | undefined
  totalPages: number
  currentPage: number
  onApplyPrice: () => void
  onUpdateMinPrice: (v: number | undefined) => void
  onUpdateMaxPrice: (v: number | undefined) => void
  onPaginate: (p: number) => void
}>()
</script>

<template>
  <div v-if="props.category">
    <!-- Full-bleed masthead -->
    <div class="border-b-2 border-highlighted bg-default">
      <div class="mx-auto max-w-6xl px-4 py-12 text-center">
        <p class="mb-3 kicker">Collection</p>
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mx-auto mt-3 max-w-lg text-muted">{{ props.category.description }}</p>
      </div>
    </div>

    <!-- Inline price filter -->
    <div class="border-b border-default bg-default/90 backdrop-blur-sm">
      <div class="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-3">
        <span class="text-xs font-semibold text-muted">Price</span>
        <EditorialInput
          :model-value="props.minPrice?.toString() ?? ''"
          type="number"
          placeholder="Min"
          class="w-28"
          @update:model-value="(v: string) => props.onUpdateMinPrice(v ? Number(v) : undefined)"
        />
        <span class="text-muted">–</span>
        <EditorialInput
          :model-value="props.maxPrice?.toString() ?? ''"
          type="number"
          placeholder="Max"
          class="w-28"
          @update:model-value="(v: string) => props.onUpdateMaxPrice(v ? Number(v) : undefined)"
        />
        <EditorialButton size="sm" color="neutral" variant="outline" @click="props.onApplyPrice">Apply</EditorialButton>
      </div>
    </div>

    <section class="mx-auto max-w-6xl px-4 py-10">
      <div v-if="props.pending" class="py-24 text-center text-muted">Loading…</div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="Nothing here yet" description="Check back soon, or browse the full catalog." />
      <template v-else>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-10 flex items-center justify-center gap-1">
          <EditorialButton v-for="p in props.totalPages" :key="p" :variant="p === props.currentPage ? 'solid' : 'ghost'" color="neutral" size="sm" square class="tabular" @click="props.onPaginate(p)">{{ p }}</EditorialButton>
        </div>
      </template>
    </section>
  </div>
</template>
