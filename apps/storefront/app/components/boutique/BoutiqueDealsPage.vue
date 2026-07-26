<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Boutique deals — the inversion of a loud flash-sale hero. No gradient, no
// urgency theater: bg-default, an eyebrow, a quiet title, a thin rule, and the
// countdown rendered as elegant minimal tabular figures separated by hairline
// dividers. The products do the talking in a centered 3-col grid.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div class="bg-default">
    <!-- Light, restrained header -->
    <header class="mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-32">
      <nav class="mb-8 text-xs uppercase tracking-[0.3em] text-muted">
        <NuxtLink to="/" class="transition-colors hover:text-highlighted">Home</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-highlighted">Deals</span>
      </nav>
      <p class="text-xs uppercase tracking-[0.4em] text-muted">Limited</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">Today's Edit</h1>
      <p class="mx-auto mt-6 max-w-md text-sm font-light leading-relaxed text-muted">
        A quiet selection of our best picks. Cash on delivery — pay when it arrives.
      </p>
      <div class="mx-auto mt-10 h-px w-12 bg-default" />
    </header>

    <!-- Elegant minimal countdown -->
    <div class="mx-auto mt-16 flex max-w-5xl items-center justify-center gap-6 px-6">
      <span class="text-xs uppercase tracking-[0.4em] text-muted">Ends in</span>
      <div class="flex items-baseline gap-4">
        <div class="flex flex-col items-center">
          <span class="text-3xl font-light tabular tracking-tight text-highlighted sm:text-4xl">{{ props.pad(props.timeLeft.hours) }}</span>
          <span class="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted">hrs</span>
        </div>
        <span class="text-2xl font-light text-muted">:</span>
        <div class="flex flex-col items-center">
          <span class="text-3xl font-light tabular tracking-tight text-highlighted sm:text-4xl">{{ props.pad(props.timeLeft.minutes) }}</span>
          <span class="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted">min</span>
        </div>
        <span class="text-2xl font-light text-muted">:</span>
        <div class="flex flex-col items-center">
          <span class="text-3xl font-light tabular tracking-tight text-highlighted sm:text-4xl">{{ props.pad(props.timeLeft.seconds) }}</span>
          <span class="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted">sec</span>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <section class="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <EmptyState
        v-if="!props.data?.items.length"
        icon="i-lucide-package-search"
        title="No deals at the moment"
        description="Check back soon for our curated picks."
      />
      <template v-else>
        <div class="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          <TemplateSection
            v-for="p in props.data.items"
            :key="p.id"
            name="ProductCard"
            :section-props="{ product: p }"
          />
        </div>
      </template>
    </section>
  </div>
</template>
