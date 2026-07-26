<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Lumiere catalog — black editorial masthead + a DENSE ALTERNATING-ROW LIST,
// not a card grid: every other row gets a faint tint, like a fashion
// magazine's product index. No sidebar — a slim inline filter row (search +
// text-tab category links) sits under the masthead instead. No shadow,
// sharp radius, Bodoni Moda heading.
const props = defineProps<{
  data: ProductListResponse | null
  pending: boolean
  categories: Category[] | null
  categoryOptions: { label: string; value: string }[]
  searchInput: string
  routeQuery: Record<string, string | undefined>
  totalPages: number
  currentPage: number
  onSearchSubmit: () => void
  onUpdateSearchInput: (v: string) => void
  onUpdateQuery: (patch: Record<string, string | number | undefined>) => void
}>()

const activeCategory = computed(() => props.routeQuery.category || 'all')
</script>

<template>
  <div>
    <div class="border-b border-black bg-black text-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Shop</span>
        </nav>
        <h1 class="font-display text-4xl text-white sm:text-5xl">Shop all products</h1>
        <p class="mt-2 max-w-xl text-white/60">Browse the full edit. Cash on delivery — pay when it lands at your door.</p>
      </div>
    </div>

    <!-- Slim inline filter row — search + text-tab category links, no sidebar -->
    <div class="border-b border-black/10 bg-white">
      <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            v-for="opt in props.categoryOptions"
            :key="opt.value"
            class="text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="activeCategory === opt.value ? 'text-primary-600 underline decoration-2 underline-offset-4' : 'text-black/45 hover:text-black'"
            @click="props.onUpdateQuery({ category: opt.value })"
          >
            {{ opt.label }}
          </button>
        </div>
        <form class="w-full sm:max-w-[220px]" @submit.prevent="props.onSearchSubmit">
          <LumiereInput :model-value="props.searchInput" placeholder="Search…" icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
        </form>
      </div>
    </div>

    <!-- Product index — dense alternating-row list, not a card grid -->
    <section class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-black/40">
        <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
      </div>
      <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products found" description="Try a different search or clear your filters.">
        <LumiereButton to="/catalog" class="mt-4">Clear filters</LumiereButton>
      </EmptyState>
      <template v-else>
        <div class="border-t border-black">
          <NuxtLink
            v-for="product in props.data.items"
            :key="product.id"
            :to="`/products/${product.slug}`"
            class="group flex items-center gap-4 border-b border-black/15 px-2 py-4 transition-colors even:bg-neutral-50 hover:bg-primary-50 sm:gap-6 sm:px-3"
          >
            <!-- Thumbnail -->
            <div class="relative size-20 shrink-0 overflow-hidden bg-neutral-100 sm:size-28">
              <NuxtImg
                v-if="resolveImageUrl(product.imageUrl)"
                :src="resolveImageUrl(product.imageUrl)"
                :alt="product.name"
                class="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                width="140"
                height="140"
                loading="lazy"
                format="webp"
              />
              <span v-if="product.stockQuantity === 0" class="absolute inset-x-0 bottom-0 bg-black py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">Sold out</span>
            </div>

            <!-- Name / category / details -->
            <div class="min-w-0 flex-1">
              <p v-if="product.category" class="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-600">{{ product.category }}</p>
              <h3 class="font-display mt-0.5 truncate text-lg text-black sm:text-2xl">{{ product.name }}</h3>
              <p v-if="product.bestSeller" class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-black/45">Best seller</p>
            </div>

            <!-- Price -->
            <div class="flex shrink-0 items-center gap-2 sm:gap-5">
              <PriceDisplay :amount-cents="product.priceCents" class="text-base font-bold text-black sm:text-xl" />
              <Icon name="i-lucide-chevron-right" class="hidden size-4 text-black/30 transition-transform group-hover:translate-x-1 sm:block" />
            </div>
          </NuxtLink>
        </div>

        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <button
            v-for="p in props.totalPages"
            :key="p"
            class="tabular flex size-9 items-center justify-center rounded border border-black/15 text-sm font-medium transition-colors"
            :class="p === props.currentPage ? 'bg-black text-white' : 'bg-white text-black hover:border-black'"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>
