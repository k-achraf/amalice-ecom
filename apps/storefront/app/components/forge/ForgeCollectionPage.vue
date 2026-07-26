<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Forge collection — branded header band + sticky filter sidebar + grid. No
// @nuxt/ui.
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
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-primary-500">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-forge-ink)]/60">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <NuxtLink to="/catalog" class="hover:underline">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-[var(--color-forge-ink)]">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-3xl uppercase sm:text-4xl lg:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-3 max-w-2xl font-medium text-[var(--color-forge-ink)]/70">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- TOP industrial filter bar, same divided-sections language as the
           catalog page, no sidebar. -->
      <div class="mb-8 flex flex-col border-[3px] border-[var(--color-forge-ink)] bg-white sm:flex-row sm:divide-x-[3px] sm:divide-[var(--color-forge-ink)]">
        <div class="border-b-[3px] border-[var(--color-forge-ink)] p-4 sm:w-80 sm:border-b-0 sm:shrink-0">
          <h3 class="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">
            <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> // Price range
          </h3>
          <div class="flex items-center gap-2">
            <ForgeInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
            <span class="text-[var(--color-forge-ink)]/30">–</span>
            <ForgeInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
          </div>
          <ForgeButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply filter</ForgeButton>
        </div>
        <div class="flex flex-1 items-center gap-3 p-4">
          <Icon name="i-lucide-banknote" class="size-5 shrink-0 text-primary-700" />
          <div class="text-sm">
            <p class="font-bold uppercase text-[var(--color-forge-ink)]">Cash on delivery</p>
            <p class="text-[var(--color-forge-ink)]/60">Pay only when it arrives — no account required.</p>
          </div>
        </div>
      </div>

      <p class="mb-6 text-sm font-bold uppercase text-[var(--color-forge-ink)]/50">{{ props.data?.items.length ?? 0 }} products in this collection</p>

      <div v-if="props.pending" class="flex items-center justify-center py-24 text-[var(--color-forge-ink)]/40">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products in this collection yet" description="Check back soon, or browse the full catalog.">
        <ForgeButton to="/catalog" class="mt-4">Browse all products</ForgeButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center border-[3px] border-[var(--color-forge-ink)] text-sm font-bold transition-colors"
            :class="p === props.currentPage ? 'bg-[var(--color-forge-ink)] text-white' : 'bg-white text-[var(--color-forge-ink)] hover:bg-primary-500'"
            @click="props.onPaginate(p)"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
