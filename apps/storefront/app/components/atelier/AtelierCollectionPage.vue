<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

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
    <div class="velvet-panel">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-atelier-cream)]/50">
          <NuxtLink to="/" class="hover:text-primary-300">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <NuxtLink to="/catalog" class="hover:text-primary-300">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-atelier-cream)]/80">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-atelier-cream)] sm:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-3 max-w-2xl text-[var(--color-atelier-cream)]/60">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="glow-card sticky top-24 space-y-6 p-5">
            <div>
              <h3 class="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
              </h3>
              <div class="flex items-center gap-2">
                <AtelierInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
                <span class="text-neutral-300">–</span>
                <AtelierInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
              </div>
              <AtelierButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply filter</AtelierButton>
            </div>
            <div class="rounded-2xl bg-primary-50 p-4 text-sm">
              <p class="font-medium text-primary-700">Cash on delivery</p>
              <p class="mt-1 text-primary-600/80">Pay only when it arrives.</p>
            </div>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <p class="mb-6 text-sm font-medium uppercase tracking-wide text-neutral-400">{{ props.data?.items.length ?? 0 }} pieces in this collection</p>

          <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <AtelierEmptyState v-else-if="!props.data?.items.length" icon="i-lucide-search-x" title="No pieces in this collection yet" description="Check back soon, or browse the full collection.">
            <AtelierButton to="/catalog" class="mt-4">Browse all pieces</AtelierButton>
          </AtelierEmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors"
                :class="p === props.currentPage ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 hover:bg-primary-50'"
                @click="props.onPaginate(p)"
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
