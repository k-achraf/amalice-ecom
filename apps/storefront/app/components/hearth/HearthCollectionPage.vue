<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Hearth collection — a light linen header band naming the category, an
// inline price filter card, and a framed-photo product grid.
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
    <div class="border-b border-neutral-200 bg-[var(--color-hearth-linen)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <NuxtLink to="/catalog" class="hover:text-primary-600">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-hearth-ink)] sm:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-2 max-w-xl text-neutral-600">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="hearth-card mb-8 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
        </h3>
        <div class="flex items-center gap-2">
          <HearthInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
          <span class="text-neutral-300">–</span>
          <HearthInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
        </div>
        <HearthButton size="sm" @click="props.onApplyPrice">Apply</HearthButton>
      </div>

      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products in this collection yet" description="Check back soon, or browse the full catalog.">
        <HearthButton to="/catalog" class="mt-4">Browse all products</HearthButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center rounded-xl text-sm font-medium transition-colors"
            :class="p === props.currentPage ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 hover:bg-primary-50'"
            @click="props.onPaginate(p)"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
