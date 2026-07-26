<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <div class="mesh-bg-strong relative overflow-hidden border-b border-neutral-100">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Deals</span>
        </nav>
        <span class="spec-chip"><Icon name="i-lucide-sparkle" class="size-3.5" /> Limited-time</span>
        <h1 class="font-display mt-5 text-4xl text-neutral-900 sm:text-5xl lg:text-6xl">Today's deals</h1>
        <p class="mt-3 max-w-xl text-neutral-500">A curated edit of our favorite gadgets. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-medium text-neutral-500">Ends in</span>
          <div class="flex items-center gap-3">
            <div class="glow-card flex size-16 flex-col items-center justify-center">
              <span class="tabular text-xl font-semibold text-primary-600">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-neutral-400">hrs</span>
            </div>
            <span class="text-xl font-semibold text-neutral-300">:</span>
            <div class="glow-card flex size-16 flex-col items-center justify-center">
              <span class="tabular text-xl font-semibold text-primary-600">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-neutral-400">min</span>
            </div>
            <span class="text-xl font-semibold text-neutral-300">:</span>
            <div class="glow-card flex size-16 flex-col items-center justify-center">
              <span class="tabular text-xl font-semibold text-primary-600">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-neutral-400">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-neutral-900">Flash picks</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} products on offer</p>
        </div>
        <PulseButton to="/catalog" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</PulseButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="rounded-2xl bg-neutral-50 px-3 py-2">
            <div class="mb-1 flex items-center justify-between text-[11px] font-medium">
              <span class="text-neutral-400">Selling fast</span>
              <span :class="p.stockQuantity > 0 ? 'text-primary-600' : 'text-red-600'">
                {{ p.stockQuantity > 0 ? `${p.stockQuantity} left` : 'Sold out' }}
              </span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                class="h-full rounded-full bg-primary-500 transition-all"
                :style="{ width: `${Math.min(100, Math.max(8, 100 - (p.stockQuantity / Math.max(p.stockQuantity + p.lowStockThreshold, 1)) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-search-x" title="No deals right now" description="Check back soon for our curated picks.">
        <PulseButton to="/catalog" class="mt-4">Browse products</PulseButton>
      </EmptyState>
    </section>
  </div>
</template>
