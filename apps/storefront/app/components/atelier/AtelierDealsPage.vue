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
    <div class="velvet-panel">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-atelier-cream)]/50">
          <NuxtLink to="/" class="hover:text-primary-300">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-atelier-cream)]/80">Deals</span>
        </nav>
        <span class="ring-badge !border-primary-400/50 !bg-white/5 !text-primary-300"><Icon name="i-lucide-sparkle" class="size-3.5" /> Limited-time</span>
        <h1 class="font-display mt-5 text-4xl text-[var(--color-atelier-cream)] sm:text-5xl lg:text-6xl">Today's picks</h1>
        <p class="mt-3 max-w-xl text-[var(--color-atelier-cream)]/60">A curated edit of our favorite pieces. Cash on delivery — pay when it arrives.</p>

        <div class="mt-8 flex items-center gap-3">
          <span class="text-sm font-medium text-[var(--color-atelier-cream)]/60">Ends in</span>
          <div class="flex items-center gap-3">
            <div class="flex size-16 flex-col items-center justify-center rounded-full border border-primary-400/30 bg-white/5">
              <span class="tabular text-xl font-semibold text-primary-300">{{ props.pad(props.timeLeft.hours) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-[var(--color-atelier-cream)]/40">hrs</span>
            </div>
            <span class="text-xl font-semibold text-[var(--color-atelier-cream)]/30">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-full border border-primary-400/30 bg-white/5">
              <span class="tabular text-xl font-semibold text-primary-300">{{ props.pad(props.timeLeft.minutes) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-[var(--color-atelier-cream)]/40">min</span>
            </div>
            <span class="text-xl font-semibold text-[var(--color-atelier-cream)]/30">:</span>
            <div class="flex size-16 flex-col items-center justify-center rounded-full border border-primary-400/30 bg-white/5">
              <span class="tabular text-xl font-semibold text-primary-300">{{ props.pad(props.timeLeft.seconds) }}</span>
              <span class="text-[9px] uppercase tracking-wide text-[var(--color-atelier-cream)]/40">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-[var(--color-atelier-ink)]">Flash picks</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} pieces on offer</p>
        </div>
        <AtelierButton to="/catalog" variant="outline" trailing-icon="i-lucide-arrow-right">Browse all</AtelierButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <div v-for="p in props.data.items" :key="p.id" class="space-y-2">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="rounded-2xl bg-neutral-50 px-3 py-2">
            <div class="mb-1 flex items-center justify-between text-[11px] font-medium">
              <span class="text-neutral-400">Selling fast</span>
              <span :class="p.stockQuantity > 0 ? 'text-primary-600' : 'text-primary-700'">
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
      <AtelierEmptyState v-else icon="i-lucide-search-x" title="No deals right now" description="Check back soon for our curated picks.">
        <AtelierButton to="/catalog" class="mt-4">Browse collection</AtelierButton>
      </AtelierEmptyState>
    </section>
  </div>
</template>
