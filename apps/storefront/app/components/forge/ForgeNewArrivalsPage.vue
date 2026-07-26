<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Forge new-arrivals — dark ink hero with a "fresh drop" sticker + newest
// grid.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-white">
      <div class="hazard-stripe h-2 w-full" aria-hidden="true" />
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm font-bold uppercase text-white/50">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">New Arrivals</span>
        </nav>
        <span class="sticker"><Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop</span>
        <h1 class="font-display mt-4 text-3xl uppercase sm:text-4xl lg:text-5xl">Just landed</h1>
        <p class="mt-3 max-w-xl font-medium text-white/60">Fresh additions to the stock list. Be the first to grab them — cash on delivery.</p>
        <ForgeButton to="/catalog" size="lg" color="neutral" variant="dark" class="mt-8">Browse all products</ForgeButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl uppercase">Latest products</h2>
          <p class="mt-1 text-sm text-[var(--color-forge-ink)]/50">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <ForgeButton to="/deals" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</ForgeButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <ForgeButton to="/catalog" class="mt-4">Browse catalog</ForgeButton>
      </EmptyState>
    </section>
  </div>
</template>
