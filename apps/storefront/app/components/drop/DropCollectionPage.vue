<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

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

function onMinInput(v: string) {
  props.onUpdateMinPrice(v ? Number(v) : undefined)
}
function onMaxInput(v: string) {
  props.onUpdateMaxPrice(v ? Number(v) : undefined)
}
</script>

<template>
  <div v-if="props.category" class="bg-black">
    <div class="border-b border-white/10 bg-[#171717]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <NuxtLink to="/catalog" class="hover:text-white">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white">{{ props.category.name }}</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl lg:text-5xl">{{ props.category.name }}</h1>
        <p v-if="props.category.description" class="mt-3 max-w-2xl font-medium text-white/50">{{ props.category.description }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="sticky top-24 space-y-6 border border-white/10 bg-[#171717] p-5">
            <div>
              <h3 class="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/40">
                <Icon name="i-lucide-sliders-horizontal" class="size-3.5" /> Price range
              </h3>
              <div class="flex items-center gap-2">
                <DropInput :model-value="props.minPrice?.toString() ?? ''" placeholder="Min" @update:model-value="onMinInput" />
                <span class="text-white/30">–</span>
                <DropInput :model-value="props.maxPrice?.toString() ?? ''" placeholder="Max" @update:model-value="onMaxInput" />
              </div>
              <DropButton block size="sm" class="mt-3" @click="props.onApplyPrice">Apply filter</DropButton>
            </div>
            <div class="border border-primary-500/40 bg-primary-500/10 p-4 text-sm">
              <p class="font-bold text-white">Cash on delivery</p>
              <p class="mt-1 text-white/60">Pay only when it arrives.</p>
            </div>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <p class="mb-6 text-sm font-bold uppercase text-white/40">{{ props.data?.items.length ?? 0 }} products in this collection</p>

          <div v-if="props.pending" class="flex items-center justify-center py-24 text-white/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
          <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-package-search" title="No products in this collection yet" description="Check back soon, or browse the full catalog.">
            <DropButton to="/catalog" class="mt-4">Browse all products</DropButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center border text-sm font-bold transition-colors"
                :class="p === props.currentPage ? 'border-primary-500 bg-primary-500 text-black' : 'border-white/10 text-white hover:border-primary-500'"
                @click="props.onPaginate(p)"
              >
                {{ p }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
