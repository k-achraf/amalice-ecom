<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Editorial new-arrivals — dark cover hero, magazine spread grid.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="relative isolate overflow-hidden bg-highlighted text-inverted">
      <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
        <p class="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-inverted/60">Just In</p>
        <h1 class="text-5xl font-bold tracking-tight sm:text-7xl">New Arrivals</h1>
        <p class="mx-auto mt-4 max-w-md text-inverted/70">Fresh additions to the edit. Be the first — cash on delivery.</p>
        <EditorialButton to="/catalog" class="mt-8 !bg-inverted !text-highlighted hover:!bg-inverted/80">Browse all</EditorialButton>
      </div>
    </div>

    <section class="mx-auto max-w-6xl px-4 py-12">
      <div v-if="props.data?.items.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon." />
    </section>
  </div>
</template>
