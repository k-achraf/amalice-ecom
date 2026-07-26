<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="bg-gradient-to-br from-[var(--color-bloom-hero-from)] to-[var(--color-bloom-hero-to)]">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-bloom-ink)]">New Arrivals</span>
        </nav>
        <span class="glow-dot"><Icon name="i-lucide-sparkles" class="size-3.5" /> Just in</span>
        <h1 class="font-display mt-5 text-4xl text-[var(--color-bloom-ink)] sm:text-5xl lg:text-6xl">Fresh drops</h1>
        <p class="mt-3 max-w-xl text-neutral-600">New additions to the edit. Cash on delivery — no account needed.</p>
        <BloomButton to="/catalog" size="lg" variant="outline" class="mt-8">Browse all products</BloomButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-[var(--color-bloom-ink)]">Latest products</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <BloomButton to="/deals" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</BloomButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-search-x" title="Nothing new yet" description="Check back soon for new arrivals.">
        <BloomButton to="/catalog" class="mt-4">Browse products</BloomButton>
      </EmptyState>
    </section>
  </div>
</template>
