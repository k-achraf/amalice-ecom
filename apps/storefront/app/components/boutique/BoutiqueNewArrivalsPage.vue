<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Boutique new arrivals — the restrained alternative to a gradient "just
// landed" banner. bg-default, eyebrow, quiet title, thin rule, then a centered
// 3-col grid of the newest pieces. Freshness communicated by restraint, not
// color.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div class="bg-default">
    <!-- Light, restrained header -->
    <header class="mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-32">
      <nav class="mb-8 text-xs uppercase tracking-[0.3em] text-muted">
        <NuxtLink to="/" class="transition-colors hover:text-highlighted">Home</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-highlighted">New Arrivals</span>
      </nav>
      <p class="text-xs uppercase tracking-[0.4em] text-muted">Freshly arrived</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">New Arrivals</h1>
      <p class="mx-auto mt-6 max-w-md text-sm font-light leading-relaxed text-muted">
        The latest additions to the collection. Be the first to claim them — cash on delivery.
      </p>
      <div class="mx-auto mt-10 h-px w-12 bg-default" />
    </header>

    <!-- Grid -->
    <section class="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <EmptyState
        v-if="!props.data?.items.length"
        icon="i-lucide-package-search"
        title="Nothing new yet"
        description="Check back soon for new arrivals."
      />
      <div v-else class="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        <TemplateSection
          v-for="p in props.data.items"
          :key="p.id"
          name="ProductCard"
          :section-props="{ product: p }"
        />
      </div>
    </section>
  </div>
</template>
