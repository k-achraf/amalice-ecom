<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Promify new arrivals — gradient hero (from-primary-600 via-primary-700 to-
// primary-900) with decorative circles + "Just landed", then a 4-col grid.
// Promify palette resolves under .tpl-promify.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <!-- Gradient hero -->
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -left-16 -top-16 size-64 rounded-full bg-white/5" />
        <div class="absolute -bottom-12 right-24 size-48 rounded-full bg-white/5" />
        <div class="absolute left-1/4 bottom-8 size-32 rounded-full bg-white/5" />
      </div>
      <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm text-white/50">
          <NuxtLink to="/" class="transition-colors hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">New Arrivals</span>
        </nav>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <Icon name="i-lucide-sparkles" class="size-3.5" /> Fresh drop
        </span>
        <h1 class="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">Just landed</h1>
        <p class="mt-3 max-w-xl text-white/70">Fresh additions to the catalog. Be the first to grab them — cash on delivery.</p>
        <PromifyButton to="/catalog" size="lg" variant="outline" color="neutral" class="mt-8 !border-white/40 !bg-white/5 !text-white hover:!bg-white/15">
          Browse all products
        </PromifyButton>
      </div>
    </div>

    <!-- 4-col grid -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold text-neutral-900">Latest products</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <PromifyButton to="/deals" color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</PromifyButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="Nothing new yet" description="Check back soon for new arrivals.">
        <PromifyButton to="/catalog" class="mt-4">Browse catalog</PromifyButton>
      </EmptyState>
    </section>
  </div>
</template>
