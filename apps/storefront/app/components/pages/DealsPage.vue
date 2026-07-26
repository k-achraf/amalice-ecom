<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Minimal (fallback) deals presentation — gradient hero + countdown + grid.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -left-16 -top-16 size-64 rounded-full bg-white/5" />
        <div class="absolute -bottom-12 right-24 size-48 rounded-full bg-white/5" />
      </div>
      <div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-8 flex items-center gap-2 text-sm text-white/50">
          <NuxtLink to="/" class="transition-colors hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Deals</span>
        </nav>
        <h1 class="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">Today's Deals</h1>
        <p class="mt-3 max-w-xl text-white/70">A curated edit of our best picks. Cash on delivery — pay when it arrives.</p>
        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-medium text-white/70">Ends in:</span>
          <div class="flex items-center gap-2">
            <div class="flex size-12 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-white">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] uppercase text-white/60">hrs</span>
            </div>
            <span class="text-xl font-bold text-white/60">:</span>
            <div class="flex size-12 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-white">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] uppercase text-white/60">min</span>
            </div>
            <span class="text-xl font-bold text-white/60">:</span>
            <div class="flex size-12 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-white">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[10px] uppercase text-white/60">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold text-highlighted">Flash picks</h2>
          <p class="mt-1 text-sm text-muted">{{ props.data?.items.length ?? 0 }} products</p>
        </div>
        <Button to="/catalog" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</Button>
      </div>
      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks." />
    </section>
  </div>
</template>
