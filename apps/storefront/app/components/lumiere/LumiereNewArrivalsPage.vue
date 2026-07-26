<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Lumiere new arrivals — black hero band + latest-products grid.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="border-b border-black bg-black text-white">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">New Arrivals</span>
        </nav>
        <span class="inline-flex items-center gap-1.5 rounded bg-primary-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          <Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop
        </span>
        <h1 class="font-display mt-4 text-4xl text-white sm:text-5xl lg:text-6xl">Just landed</h1>
        <p class="mt-3 max-w-xl text-white/60">Fresh additions to the catalog. Be the first to grab them — cash on delivery.</p>
        <LumiereButton to="/catalog" size="lg" color="neutral" class="mt-8">Browse all products</LumiereButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-black">Latest products</h2>
          <p class="mt-1 text-sm text-black/50">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <LumiereButton to="/deals" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</LumiereButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <LumiereButton to="/catalog" class="mt-4">Browse catalog</LumiereButton>
      </EmptyState>
    </section>
  </div>
</template>
