<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Promify deals — gradient hero (from-primary-600 via-primary-700 to-
// primary-900) with decorative circles + countdown as glass cards
// (bg-white/15 backdrop-blur), then a flash-deal grid with a stock progress
// bar under each deal card. Promify palette resolves under .tpl-promify.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <!-- Gradient hero -->
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -left-16 -top-16 size-64 rounded-full bg-white/5" />
        <div class="absolute -bottom-12 right-24 size-48 rounded-full bg-white/5" />
        <div class="absolute right-1/3 top-10 size-24 rounded-full bg-white/5" />
      </div>
      <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm text-white/50">
          <NuxtLink to="/" class="transition-colors hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Deals</span>
        </nav>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <Icon name="i-lucide-zap" class="size-3.5" /> Flash sale
        </span>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Today's deals</h1>
        <p class="mt-3 max-w-xl text-white/70">A curated edit of our best picks. Cash on delivery — pay when it arrives.</p>

        <!-- Countdown as glass cards -->
        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-medium text-white/70">Ends in:</span>
          <div class="flex items-center gap-3">
            <div class="flex size-16 flex-col items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-md">
              <span class="tabular text-2xl font-bold text-white">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[10px] uppercase tracking-wide text-white/60">hrs</span>
            </div>
            <span class="text-2xl font-bold text-white/40">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-md">
              <span class="tabular text-2xl font-bold text-white">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[10px] uppercase tracking-wide text-white/60">min</span>
            </div>
            <span class="text-2xl font-bold text-white/40">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-md">
              <span class="tabular text-2xl font-bold text-white">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[10px] uppercase tracking-wide text-white/60">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Flash-deal grid -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold text-neutral-900">Flash picks</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} products on sale</p>
        </div>
        <PromifyButton to="/catalog" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</PromifyButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <!-- Stock progress bar -->
          <div class="rounded-xl border border-neutral-100 bg-white px-3 py-2 shadow-sm">
            <div class="mb-1 flex items-center justify-between text-[11px] font-medium">
              <span class="text-neutral-500">Selling fast</span>
              <span :class="p.stockQuantity > 0 ? 'text-primary-600' : 'text-red-500'">
                {{ p.stockQuantity > 0 ? `${p.stockQuantity} left` : 'Sold out' }}
              </span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700 transition-all"
                :style="{ width: `${Math.min(100, Math.max(8, 100 - (p.stockQuantity / Math.max(p.stockQuantity + p.lowStockThreshold, 1)) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No deals right now" description="Check back soon for our curated picks.">
        <PromifyButton to="/catalog" class="mt-4">Browse catalog</PromifyButton>
      </EmptyState>
    </section>
  </div>
</template>
