<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Trove deals — a mustard band with a countdown, circle-on-sharp-frame grid
// below. No dark surfaces (Trove's rule) — the "deal" energy comes from the
// mustard panel, not a black backdrop.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-primary-500 text-[var(--color-trove-ink)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm text-[var(--color-trove-ink)]/70">
          <NuxtLink to="/" class="hover:text-[var(--color-trove-ink)]">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-[var(--color-trove-ink)]">Deals</span>
        </nav>
        <span class="trove-tag !border-[var(--color-trove-ink)]/40 !bg-white/60 !text-[var(--color-trove-ink)]"><Icon name="i-lucide-percent" class="size-3" /> Limited time</span>
        <h1 class="font-display mt-4 text-3xl text-[var(--color-trove-ink)] sm:text-4xl lg:text-5xl">Seasonal finds</h1>
        <p class="mt-3 max-w-xl text-[var(--color-trove-ink)]/80">A curated edit of our best pieces. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-bold text-[var(--color-trove-ink)]/80">Ends in:</span>
          <div class="flex items-center gap-3">
            <div class="flex size-14 flex-col items-center justify-center rounded-full bg-white/40 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-[var(--color-trove-ink)]">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[9px] uppercase text-[var(--color-trove-ink)]/70">hrs</span>
            </div>
            <span class="text-xl font-bold text-[var(--color-trove-ink)]/50">:</span>
            <div class="flex size-14 flex-col items-center justify-center rounded-full bg-white/40 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-[var(--color-trove-ink)]">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[9px] uppercase text-[var(--color-trove-ink)]/70">min</span>
            </div>
            <span class="text-xl font-bold text-[var(--color-trove-ink)]/50">:</span>
            <div class="flex size-14 flex-col items-center justify-center rounded-full bg-white/40 backdrop-blur-sm">
              <span class="tabular text-lg font-bold text-[var(--color-trove-ink)]">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[9px] uppercase text-[var(--color-trove-ink)]/70">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl text-[var(--color-trove-ink)]">Today's finds</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} products on offer</p>
        </div>
        <TroveButton to="/catalog" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</TroveButton>
      </div>
      <div v-if="props.data?.items.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks." />
    </section>
  </div>
</template>
