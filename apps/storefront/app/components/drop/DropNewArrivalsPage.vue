<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div class="bg-black">
    <div class="border-b border-white/10 bg-[#171717]">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm font-bold uppercase text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">New Arrivals</span>
        </nav>
        <span class="sticker"><Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop</span>
        <h1 class="font-display mt-4 text-3xl text-white sm:text-4xl lg:text-5xl">Just landed</h1>
        <p class="mt-3 max-w-xl font-medium text-white/50">Fresh additions to the catalog. Be the first to grab them — cash on delivery.</p>
        <DropButton to="/catalog" size="lg" class="mt-8">Browse all products</DropButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl text-white">Latest products</h2>
          <p class="mt-1 text-sm text-white/40">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <DropButton to="/deals" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</DropButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <DropButton to="/catalog" class="mt-4">Browse catalog</DropButton>
      </EmptyState>
    </section>
  </div>
</template>
