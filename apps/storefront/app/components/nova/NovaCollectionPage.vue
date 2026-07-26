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
    <div class="border-b-2 border-black bg-primary-500">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-black/60">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <NuxtLink to="/catalog" class="hover:underline">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-black">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-3xl uppercase sm:text-4xl lg:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-3 max-w-2xl font-medium text-black/70">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="sticky top-24 space-y-6 border-2 border-black bg-white p-5 shadow-[var(--shadow-nova-sm)]">
            <div>
              <h3 class="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/50">
                <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
              </h3>
              <div class="flex items-center gap-2">
                <NovaInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
                <span class="text-black/30">–</span>
                <NovaInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
              </div>
              <NovaButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply filter</NovaButton>
            </div>
            <div class="border-2 border-black bg-primary-100 p-4 text-sm">
              <p class="font-bold">Cash on delivery</p>
              <p class="mt-1 text-black/70">Pay only when it arrives.</p>
            </div>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <p class="mb-6 text-sm font-bold uppercase text-black/50">{{ props.data?.items.length ?? 0 }} products in this collection</p>

          <div v-if="props.pending" class="flex items-center justify-center py-24 text-black/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <NovaEmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products in this collection yet" description="Check back soon, or browse the full catalog.">
            <NovaButton to="/catalog" class="mt-4">Browse all products</NovaButton>
          </NovaEmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center border-2 border-black text-sm font-bold transition-colors"
                :class="p === props.currentPage ? 'bg-black text-white' : 'bg-white text-black hover:bg-primary-500'"
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
