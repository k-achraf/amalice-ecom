<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Hearth new arrivals — a light linen header band, framed-photo grid of the
// newest pieces.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-[var(--color-hearth-linen)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">New arrivals</span>
        </nav>
        <span class="swatch-tag"><Icon name="i-lucide-sparkles" class="size-3" /> Just landed</span>
        <h1 class="font-display mt-4 text-3xl text-[var(--color-hearth-ink)] sm:text-4xl lg:text-5xl">New in the shop</h1>
        <p class="mt-3 max-w-xl text-neutral-600">Fresh pieces for the home. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.data?.items.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals." />
    </section>
  </div>
</template>
