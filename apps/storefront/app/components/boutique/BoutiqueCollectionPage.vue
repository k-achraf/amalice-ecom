<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Boutique collection — a category-scoped catalog, but the boutique reading:
// narrow (max-w-5xl), a branded category header (eyebrow + name + thin rule),
// a minimal inline price filter (no sidebar — luxury pages center everything),
// and a 3-col grid. No search/category chips here (collection IS the category).
const props = defineProps<{
  category: Category | null
  data: ProductListResponse | null
  pending: boolean
  minPrice: number | undefined
  maxPrice: number | undefined
  totalPages: number
  currentPage: number
  onApplyPrice: () => void
  onUpdateMinPrice: (v: number | undefined) => void
  onUpdateMaxPrice: (v: number | undefined) => void
  onPaginate: (p: number) => void
}>()
</script>

<template>
  <div v-if="props.category" class="bg-default">
    <!-- Branded category header -->
    <header class="mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-32">
      <nav class="mb-8 text-xs uppercase tracking-[0.3em] text-muted">
        <NuxtLink to="/" class="transition-colors hover:text-highlighted">Home</NuxtLink>
        <span class="mx-2">/</span>
        <NuxtLink to="/catalog" class="transition-colors hover:text-highlighted">Shop</NuxtLink>
      </nav>
      <p class="text-xs uppercase tracking-[0.4em] text-muted">Collection</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">{{ props.category.name }}</h1>
      <p v-if="props.category.description" class="mx-auto mt-6 max-w-md text-sm font-light leading-relaxed text-muted">
        {{ props.category.description }}
      </p>
      <div class="mx-auto mt-10 h-px w-12 bg-default" />
    </header>

    <!-- Minimal price filter — centered, inline -->
    <div class="mx-auto mt-14 max-w-5xl px-6">
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <span class="text-xs uppercase tracking-[0.3em] text-muted">Price</span>
        <div class="flex items-center gap-3">
          <BoutiqueInput
            :model-value="props.minPrice?.toString() ?? ''"
            type="number"
            placeholder="Min"
            class="w-24 text-center"
            @update:model-value="(v: string) => props.onUpdateMinPrice(v ? Number(v) : undefined)"
          />
          <span class="text-muted">—</span>
          <BoutiqueInput
            :model-value="props.maxPrice?.toString() ?? ''"
            type="number"
            placeholder="Max"
            class="w-24 text-center"
            @update:model-value="(v: string) => props.onUpdateMaxPrice(v ? Number(v) : undefined)"
          />
        </div>
        <BoutiqueButton size="sm" color="neutral" variant="outline" @click="props.onApplyPrice">
          Apply
        </BoutiqueButton>
      </div>
    </div>

    <!-- Grid -->
    <section class="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <div v-if="props.pending" class="py-32 text-center text-xs uppercase tracking-[0.3em] text-muted">Loading…</div>
      <EmptyState
        v-else-if="!props.data?.items.length"
        icon="i-lucide-package-search"
        title="No pieces in this collection"
        description="Check back soon, or browse the full catalog."
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

        <!-- Refined pagination -->
        <nav v-if="props.totalPages > 1" class="mt-24 flex items-center justify-center gap-3">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="size-9 text-xs tabular transition-colors"
            :class="p === props.currentPage
              ? 'border border-default bg-highlighted text-inverted'
              : 'text-muted hover:text-highlighted'"
            @click="props.onPaginate(p)"
          >
            {{ p }}
          </button>
        </nav>
      </template>
    </section>
  </div>
</template>
