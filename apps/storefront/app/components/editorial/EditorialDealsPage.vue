<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Editorial deals — bold dark hero (the issue cover), the countdown as large
// display numbers, then a magazine spread of picks.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div>
    <!-- Dark cover-style hero -->
    <div class="relative isolate overflow-hidden bg-highlighted text-inverted">
      <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
        <p class="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-inverted/60">The Deal Issue</p>
        <h1 class="text-5xl font-bold tracking-tight sm:text-7xl">Today's Picks</h1>
        <p class="mx-auto mt-4 max-w-md text-inverted/70">A curated edit. Cash on delivery — pay when it lands.</p>

        <!-- Countdown as display type -->
        <div class="mt-10 flex items-center justify-center gap-4">
          <div class="text-center">
            <div class="tabular text-5xl font-bold sm:text-6xl">{{ props.pad(props.timeLeft.hours) }}</div>
            <div class="text-xs uppercase tracking-widest text-inverted/50">Hours</div>
          </div>
          <span class="text-5xl font-bold text-inverted/30">:</span>
          <div class="text-center">
            <div class="tabular text-5xl font-bold sm:text-6xl">{{ props.pad(props.timeLeft.minutes) }}</div>
            <div class="text-xs uppercase tracking-widest text-inverted/50">Minutes</div>
          </div>
          <span class="text-5xl font-bold text-inverted/30">:</span>
          <div class="text-center">
            <div class="tabular text-5xl font-bold sm:text-6xl">{{ props.pad(props.timeLeft.seconds) }}</div>
            <div class="text-xs uppercase tracking-widest text-inverted/50">Seconds</div>
          </div>
        </div>
      </div>
    </div>

    <section class="mx-auto max-w-6xl px-4 py-12">
      <div class="mb-8 flex items-end justify-between">
        <h2 class="text-2xl font-bold tracking-tight">The Picks</h2>
        <p class="text-sm text-muted">{{ props.data?.items.length ?? 0 }} items</p>
      </div>
      <div v-if="props.data?.items.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="No picks today" description="Check back tomorrow." />
    </section>
  </div>
</template>
