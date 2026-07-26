<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Trove collection — a light cream header band naming the category, an
// inline price filter card, and a circle-on-sharp-frame product grid.
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

function onMinInput(v: string) {
  props.onUpdateMinPrice(v ? Number(v) : undefined)
}
function onMaxInput(v: string) {
  props.onUpdateMaxPrice(v ? Number(v) : undefined)
}
</script>

<template>
  <div v-if="props.category">
    <div class="border-b border-neutral-200 bg-[var(--color-trove-cream)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-[var(--color-trove-teal)]">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <NuxtLink to="/catalog" class="hover:text-[var(--color-trove-teal)]">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-trove-ink)] sm:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-2 max-w-xl text-neutral-600">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- Right-side accessory panel (price filter + a decorative charm
           callout), matching the catalog page's right-sidebar language
           instead of a top filter bar. -->
      <div class="flex flex-col gap-8 lg:flex-row">
        <div class="min-w-0 flex-1">
          <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products in this collection yet" description="Check back soon, or browse the full catalog.">
            <TroveButton to="/catalog" class="mt-4">Browse all products</TroveButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center rounded text-sm font-bold transition-colors"
                :class="p === props.currentPage ? 'bg-primary-500 text-[var(--color-trove-ink)]' : 'bg-white text-neutral-600 hover:bg-primary-50'"
                @click="props.onPaginate(p)"
              >
                {{ p }}
              </button>
            </div>
          </template>
        </div>

        <aside class="w-full shrink-0 lg:w-64">
          <div class="trove-card sticky top-24 space-y-6 p-5">
            <div>
              <h3 class="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
                <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
              </h3>
              <div class="flex items-center gap-2">
                <TroveInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
                <span class="text-neutral-300">–</span>
                <TroveInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
              </div>
              <TroveButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply</TroveButton>
            </div>
            <div class="h-px bg-neutral-100" />
            <div class="flex items-center gap-3 text-sm">
              <span class="trove-photo flex size-11 shrink-0 items-center justify-center bg-primary-100">
                <Icon name="i-lucide-banknote" class="size-4 text-primary-700" />
              </span>
              <p class="text-neutral-500">Cash on delivery — pay only when it arrives.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>
