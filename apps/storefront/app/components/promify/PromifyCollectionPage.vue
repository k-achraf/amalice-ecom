<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Promify collection — branded gradient header band with the category name,
// sticky sidebar price filter + 3-col grid. Reuses the Promify sidebar
// pattern scoped to price. Promify palette resolves under .tpl-promify.
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
  <div v-if="props.category">
    <!-- Branded gradient header band -->
    <div class="relative overflow-hidden bg-gradient-to-r from-primary-600 to-primary-900">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -left-16 -top-16 size-64 rounded-full bg-white/5" />
        <div class="absolute -bottom-12 right-24 size-48 rounded-full bg-white/5" />
      </div>
      <div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-white/60">
          <NuxtLink to="/" class="transition-colors hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <NuxtLink to="/catalog" class="transition-colors hover:text-white">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/90">{{ props.category.name }}</span>
        </nav>
        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-3 max-w-2xl text-white/70">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <!-- Sticky sidebar price filter -->
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="sticky top-20 space-y-6 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
            <div>
              <h3 class="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
              </h3>
              <div class="flex items-center gap-2">
                <PromifyInput :model-value="props.minPrice?.toString() ?? ''" type="number" placeholder="Min" :min="0" size="sm" class="w-full" @update:model-value="(v: string) => props.onUpdateMinPrice(v ? Number(v) : undefined)" />
                <span class="text-neutral-300">–</span>
                <PromifyInput :model-value="props.maxPrice?.toString() ?? ''" type="number" placeholder="Max" :min="0" size="sm" class="w-full" @update:model-value="(v: string) => props.onUpdateMaxPrice(v ? Number(v) : undefined)" />
              </div>
              <PromifyButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply filter</PromifyButton>
            </div>

            <div class="rounded-xl bg-primary-50 p-4 text-sm">
              <p class="font-medium text-primary-700">Cash on delivery</p>
              <p class="mt-1 text-primary-600/80">Pay only when it arrives.</p>
            </div>
          </div>
        </aside>

        <!-- Grid -->
        <div class="min-w-0 flex-1">
          <div class="mb-6 flex items-end justify-between">
            <p class="text-sm text-neutral-500">{{ props.data?.items.length ?? 0 }} products in this collection</p>
          </div>

          <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <EmptyState
            v-else-if="!props.data?.items.length"
            icon="i-lucide-package-search"
            title="No products in this collection yet"
            description="Check back soon, or browse the full catalog."
          >
            <PromifyButton to="/catalog" class="mt-4">Browse all products</PromifyButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
            </div>

            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <PromifyButton
                v-for="p in props.totalPages"
                :key="p"
                :color="p === props.currentPage ? 'primary' : 'neutral'"
                :variant="p === props.currentPage ? 'solid' : 'ghost'"
                size="sm"
                square
                class="tabular"
                @click="props.onPaginate(p)"
              >
                {{ p }}
              </PromifyButton>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
