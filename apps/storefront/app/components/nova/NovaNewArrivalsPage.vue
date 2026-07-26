<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="border-b-2 border-black bg-black text-white">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm font-bold uppercase text-white/50">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">New Arrivals</span>
        </nav>
        <span class="sticker"><Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop</span>
        <h1 class="font-display mt-4 text-3xl uppercase sm:text-4xl lg:text-5xl">Just landed</h1>
        <p class="mt-3 max-w-xl font-medium text-white/60">Fresh additions to the catalog. Be the first to grab them — cash on delivery.</p>
        <NovaButton to="/catalog" size="lg" variant="dark" class="mt-8">Browse all products</NovaButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl uppercase">Latest products</h2>
          <p class="mt-1 text-sm text-black/50">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <NovaButton to="/deals" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</NovaButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <NovaEmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <NovaButton to="/catalog" class="mt-4">Browse catalog</NovaButton>
      </NovaEmptyState>
    </section>
  </div>
</template>
