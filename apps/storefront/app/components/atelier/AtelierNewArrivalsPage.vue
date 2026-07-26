<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="velvet-panel">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-atelier-cream)]/50">
          <NuxtLink to="/" class="hover:text-primary-300">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-atelier-cream)]/80">New Arrivals</span>
        </nav>
        <span class="ring-badge !border-primary-400/50 !bg-white/5 !text-primary-300"><Icon name="i-lucide-sparkles" class="size-3.5" /> Just in</span>
        <h1 class="font-display mt-5 text-4xl text-[var(--color-atelier-cream)] sm:text-5xl lg:text-6xl">New arrivals</h1>
        <p class="mt-3 max-w-xl text-[var(--color-atelier-cream)]/60">Fresh additions to the collection. Cash on delivery — no account needed.</p>
        <AtelierButton to="/catalog" size="lg" variant="outline" class="mt-8 !border-white/25 !text-[var(--color-atelier-cream)] hover:!border-primary-400 hover:!bg-white/5">Browse all pieces</AtelierButton>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="font-display text-3xl text-[var(--color-atelier-ink)]">Latest pieces</h2>
          <p class="mt-1 text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} new arrivals</p>
        </div>
        <AtelierButton to="/deals" variant="outline" trailing-icon="i-lucide-arrow-right">View deals</AtelierButton>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <AtelierEmptyState v-else icon="i-lucide-search-x" title="Nothing new yet" description="Check back soon for new arrivals.">
        <AtelierButton to="/catalog" class="mt-4">Browse collection</AtelierButton>
      </AtelierEmptyState>
    </section>
  </div>
</template>
