<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Hearth deals — a warm terracotta band with a countdown, framed-photo grid
// below. No dark surfaces (Hearth's rule) — the "deal" energy comes from the
// terracotta panel, not a black backdrop.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-primary-500 text-white">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm text-white/70">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white">Deals</span>
        </nav>
        <span class="swatch-tag !border-white/50 !bg-white/15 !text-white"><Icon name="i-lucide-percent" class="size-3" /> Limited time</span>
        <h1 class="font-display mt-4 text-3xl text-white sm:text-4xl lg:text-5xl">Seasonal picks</h1>
        <p class="mt-3 max-w-xl text-white/80">A curated edit of our best pieces. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-medium text-white/80">Ends in:</span>
          <div class="flex items-center gap-2">
            <div class="flex size-14 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-semibold text-white">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] uppercase text-white/70">hrs</span>
            </div>
            <span class="text-xl font-semibold text-white/60">:</span>
            <div class="flex size-14 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-semibold text-white">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] uppercase text-white/70">min</span>
            </div>
            <span class="text-xl font-semibold text-white/60">:</span>
            <div class="flex size-14 flex-col items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span class="tabular text-lg font-semibold text-white">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[10px] uppercase text-white/70">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl text-[var(--color-hearth-ink)]">Today's picks</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} products on offer</p>
        </div>
        <HearthButton to="/catalog" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</HearthButton>
      </div>
      <div v-if="props.data?.items.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks." />
    </section>
  </div>
</template>
