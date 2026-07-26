<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Volt new-arrivals — black hero with grid-line motif + grid.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div class="bg-black">
    <div class="volt-grid-bg border-b border-white/10 bg-black">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="font-mono-spec mb-6 flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">New Arrivals</span>
        </nav>
        <span class="spec-badge"><Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop</span>
        <h1 class="font-display mt-4 text-3xl text-white sm:text-4xl lg:text-5xl">Just landed</h1>
        <p class="mt-3 max-w-xl text-white/50">Fresh additions to the catalog. Be the first to grab them — cash on delivery.</p>
        <VoltButton to="/catalog" size="lg" color="neutral" variant="outline" class="mt-8">Browse all products</VoltButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl text-white">Latest products</h2>
          <p class="mt-1 text-sm text-white/40">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <VoltButton to="/deals" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</VoltButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <VoltButton to="/catalog" class="mt-4">Browse catalog</VoltButton>
      </EmptyState>
    </section>
  </div>
</template>
