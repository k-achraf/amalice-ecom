<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Volt deals — black hero with grid-line motif + mono countdown + grid,
// each product card gets a stock-pressure meter panel underneath.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div class="bg-black">
    <div class="volt-grid-bg border-b border-white/10 bg-black">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="font-mono-spec mb-6 flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">Deals</span>
        </nav>
        <span class="spec-badge"><Icon name="i-lucide-zap" class="size-3.5" /> Flash sale</span>
        <h1 class="font-display mt-4 text-3xl text-white sm:text-4xl lg:text-5xl">Today's deals</h1>
        <p class="mt-3 max-w-xl text-white/50">A curated edit of our best picks. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="font-mono-spec text-xs uppercase tracking-wide text-white/40">Ends in:</span>
          <div class="flex items-center gap-3">
            <div class="flex size-16 flex-col items-center justify-center rounded-md border border-primary-400/40 bg-primary-400/5">
              <span class="font-mono-spec text-2xl text-primary-400">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] uppercase text-white/40">hrs</span>
            </div>
            <span class="text-2xl text-white/20">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-md border border-primary-400/40 bg-primary-400/5">
              <span class="font-mono-spec text-2xl text-primary-400">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] uppercase text-white/40">min</span>
            </div>
            <span class="text-2xl text-white/20">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-md border border-primary-400/40 bg-primary-400/5">
              <span class="font-mono-spec text-2xl text-primary-400">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[10px] uppercase text-white/40">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-2xl text-white">Flash picks</h2>
          <p class="mt-1 text-sm text-white/40">{{ props.data?.items.length ?? 0 }} products on sale</p>
        </div>
        <VoltButton to="/catalog" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</VoltButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="rounded-md border border-white/10 bg-[#0c1113] px-3 py-2">
            <div class="font-mono-spec mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide">
              <span class="text-white/40">Selling fast</span>
              <span :class="p.stockQuantity > 0 ? 'text-primary-400' : 'text-red-400'">
                {{ p.stockQuantity > 0 ? `${p.stockQuantity} left` : 'Sold out' }}
              </span>
            </div>
            <div class="h-1.5 w-full rounded-md bg-white/10">
              <div
                class="h-full rounded-md bg-primary-500 transition-all"
                :style="{ width: `${Math.min(100, Math.max(8, 100 - (p.stockQuantity / Math.max(p.stockQuantity + p.lowStockThreshold, 1)) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks.">
        <VoltButton to="/catalog" class="mt-4">Browse catalog</VoltButton>
      </EmptyState>
    </section>
  </div>
</template>
