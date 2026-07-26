<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Forge deals — dark ink hero with a countdown, hazard-stripe flash-sale
// sticker, flash-pick grid with stock-level bars below each card.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-white">
      <div class="hazard-stripe h-2 w-full" aria-hidden="true" />
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm font-bold uppercase text-white/50">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Deals</span>
        </nav>
        <span class="sticker"><Icon name="i-lucide-zap" class="size-3.5" /> Flash sale</span>
        <h1 class="font-display mt-4 text-3xl uppercase sm:text-4xl lg:text-5xl">Today's deals</h1>
        <p class="mt-3 max-w-xl font-medium text-white/60">A curated edit of our best picks. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-bold uppercase text-white/60">Ends in:</span>
          <div class="flex items-center gap-3">
            <div class="flex size-16 flex-col items-center justify-center border-[3px] border-primary-500 bg-white/5">
              <span class="tabular text-2xl font-bold text-primary-500">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] font-bold uppercase text-white/50">hrs</span>
            </div>
            <span class="text-2xl font-bold text-white/30">:</span>
            <div class="flex size-16 flex-col items-center justify-center border-[3px] border-primary-500 bg-white/5">
              <span class="tabular text-2xl font-bold text-primary-500">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] font-bold uppercase text-white/50">min</span>
            </div>
            <span class="text-2xl font-bold text-white/30">:</span>
            <div class="flex size-16 flex-col items-center justify-center border-[3px] border-primary-500 bg-white/5">
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
          <h2 class="font-display text-2xl uppercase">Flash picks</h2>
          <p class="mt-1 text-sm text-[var(--color-forge-ink)]/50">{{ props.data?.items.length ?? 0 }} products on sale</p>
        </div>
        <ForgeButton to="/catalog" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</ForgeButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="border-[3px] border-[var(--color-forge-ink)] bg-white px-3 py-2">
            <div class="mb-1 flex items-center justify-between text-[11px] font-bold uppercase">
              <span class="font-mono text-[var(--color-forge-ink)]/50">// stock</span>
              <span class="font-mono" :class="p.stockQuantity > 0 ? 'text-primary-700' : 'text-red-700'">
                {{ p.stockQuantity > 0 ? `${p.stockQuantity} left` : 'Sold out' }}
              </span>
            </div>
            <div class="h-2 w-full border border-[var(--color-forge-ink)]/20 bg-neutral-100">
              <div
                class="h-full bg-primary-500 transition-all"
                :style="{ width: `${Math.min(100, Math.max(8, 100 - (p.stockQuantity / Math.max(p.stockQuantity + p.lowStockThreshold, 1)) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks.">
        <ForgeButton to="/catalog" class="mt-4">Browse catalog</ForgeButton>
      </EmptyState>
    </section>
  </div>
</template>
