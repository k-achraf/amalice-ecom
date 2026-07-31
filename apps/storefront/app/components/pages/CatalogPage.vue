<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Minimal (fallback) catalog presentation — top filter bar + 4-col grid.
// The prop contract every CatalogPage override follows: receive the
// logic-derived state + handlers from the page shell, render only markup.
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
</script>

<template>
  <main class="mx-auto max-w-7xl p-4">
    <h1 class="mb-4 text-xl font-semibold">تسوق جميع المنتجات</h1>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <!-- Left sidebar filters -->
      <aside class="space-y-5 lg:border-e lg:border-default lg:pe-4">
        <form class="flex gap-2" @submit.prevent="props.onSearchSubmit">
          <Input
            :model-value="props.searchInput"
            placeholder="ابحث عن المنتجات..."
            icon="i-lucide-search"
            size="sm"
            class="w-full"
            @update:model-value="props.onUpdateSearchInput"
          />
        </form>

        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">الفئة</p>
          <nav class="flex flex-row flex-wrap gap-1 lg:flex-col lg:gap-0.5">
            <button
              v-for="opt in props.categoryOptions"
              :key="opt.value"
              type="button"
              class="rounded px-2 py-1 text-start text-sm transition-colors"
              :class="(props.routeQuery.category ?? 'all') === opt.value
                ? 'bg-elevated font-medium text-highlighted'
                : 'text-muted hover:bg-elevated hover:text-highlighted'"
              @click="props.onUpdateQuery({ category: opt.value })"
            >
              {{ opt.label }}
            </button>
          </nav>
        </div>
      </aside>

      <!-- Product grid -->
      <div class="min-w-0">
        <div v-if="props.pending" class="py-24 text-center text-muted">جارٍ التحميل...</div>
        <EmptyState
          v-else-if="!props.data?.items.length"
          icon="i-lucide-package-search"
          title="لم يتم العثور على منتجات"
          description="جرّب بحثاً مختلفاً أو امسح عوامل التصفية."
        />
        <template v-else>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <TemplateSection
              v-for="product in props.data.items"
              :key="product.id"
              name="ProductCard"
              :section-props="{ product }"
            />
          </div>

          <div v-if="props.totalPages > 1" class="flex justify-center gap-2 pt-4">
            <Button
              v-for="p in props.totalPages"
              :key="p"
              :variant="p === props.currentPage ? 'solid' : 'outline'"
              color="neutral"
              size="sm"
              @click="props.onUpdateQuery({ page: p })"
            >
              {{ p }}
            </Button>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>
