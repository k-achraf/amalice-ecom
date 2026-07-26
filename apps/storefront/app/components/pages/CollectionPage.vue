<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Minimal (fallback) collection presentation — branded header + filter sidebar
// + grid. Prop contract mirrors Catalog with category-scoped data.
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
  <main v-if="props.category" class="mx-auto max-w-7xl space-y-8 p-6">
    <header class="space-y-2">
      <nav class="text-sm text-muted">
        <NuxtLink to="/" class="hover:text-highlighted">Home</NuxtLink> /
        <NuxtLink to="/catalog" class="hover:text-highlighted">Shop</NuxtLink> /
        <span>{{ props.category.name }}</span>
      </nav>
      <h1 class="text-3xl font-bold">{{ props.category.name }}</h1>
      <p v-if="props.category.description" class="text-muted">{{ props.category.description }}</p>
    </header>

    <div class="flex gap-8">
      <aside class="hidden w-56 shrink-0 lg:block">
        <div class="sticky top-4 space-y-6">
          <div>
            <h3 class="mb-3 text-sm font-semibold">Price range ($)</h3>
            <div class="flex items-center gap-2">
              <Input
                :model-value="props.minPrice?.toString() ?? ''"
                type="number"
                placeholder="Min"
                @update:model-value="(v: string) => props.onUpdateMinPrice(v ? Number(v) : undefined)"
              />
              <span class="text-muted">–</span>
              <Input
                :model-value="props.maxPrice?.toString() ?? ''"
                type="number"
                placeholder="Max"
                @update:model-value="(v: string) => props.onUpdateMaxPrice(v ? Number(v) : undefined)"
              />
            </div>
            <Button class="mt-2" size="xs" color="neutral" variant="outline" block @click="props.onApplyPrice">Apply</Button>
          </div>
        </div>
      </aside>

      <div class="flex-1 space-y-6">
        <div v-if="props.pending" class="py-24 text-center text-muted">Loading…</div>
        <EmptyState
          v-else-if="!props.data?.items.length"
          icon="i-lucide-package-search"
          title="No products in this collection yet"
          description="Check back soon, or browse the full catalog."
        />
        <template v-else>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
          </div>
          <div v-if="props.totalPages > 1" class="flex justify-center gap-2 pt-4">
            <Button
              v-for="p in props.totalPages"
              :key="p"
              :variant="p === props.currentPage ? 'solid' : 'outline'"
              color="neutral"
              size="sm"
              @click="props.onPaginate(p)"
            >{{ p }}</Button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>
