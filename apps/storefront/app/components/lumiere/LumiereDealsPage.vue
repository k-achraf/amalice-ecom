<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Lumiere deals — black hero with crimson countdown chips + flash-pick grid
// with a stock-progress color-block bar.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="border-b border-black bg-black text-white">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Deals</span>
        </nav>
        <span class="inline-flex items-center gap-1.5 rounded bg-primary-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          <Icon name="i-lucide-zap" class="size-3.5" /> Flash sale
        </span>
        <h1 class="font-display mt-4 text-4xl text-white sm:text-5xl lg:text-6xl">Today's deals</h1>
        <p class="mt-3 max-w-xl text-white/60">A curated edit of our best picks. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Ends in:</span>
          <div class="flex items-center gap-3">
            <div class="flex size-16 flex-col items-center justify-center rounded border border-primary-600 bg-white/5">
              <span class="tabular text-2xl font-bold text-primary-500">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] font-bold uppercase text-white/50">hrs</span>
            </div>
            <span class="text-2xl font-bold text-white/25">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded border border-primary-600 bg-white/5">
              <span class="tabular text-2xl font-bold text-primary-500">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] font-bold uppercase text-white/50">min</span>
            </div>
            <span class="text-2xl font-bold text-white/25">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded border border-primary-600 bg-white/5">
              <span class="tabular text-2xl font-bold text-primary-500">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[10px] font-bold uppercase text-white/50">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-black">Flash picks</h2>
          <p class="mt-1 text-sm text-black/50">{{ props.data?.items.length ?? 0 }} products on sale</p>
        </div>
        <LumiereButton to="/catalog" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</LumiereButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="rounded border border-black/10 bg-white px-3 py-2">
            <div class="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.1em]">
              <span class="text-black/45">Selling fast</span>
              <span :class="p.stockQuantity > 0 ? 'text-primary-700' : 'text-black'">
                {{ p.stockQuantity > 0 ? `${p.stockQuantity} left` : 'Sold out' }}
              </span>
            </div>
            <div class="h-1.5 w-full rounded bg-neutral-100">
              <div
                class="h-full rounded bg-primary-600 transition-all"
                :style="{ width: `${Math.min(100, Math.max(8, 100 - (p.stockQuantity / Math.max(p.stockQuantity + p.lowStockThreshold, 1)) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks.">
        <LumiereButton to="/catalog" class="mt-4">Browse catalog</LumiereButton>
      </EmptyState>
    </section>
  </div>
</template>
