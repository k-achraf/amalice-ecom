<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Hearth catalog — a light linen header band (never dark), a sticky
// hearth-card sidebar (search + category filters), and a framed-photo
// product grid.
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
    <div class="border-b border-neutral-200 bg-[var(--color-hearth-linen)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">الرئيسية</NuxtLink>
          <Icon name="i-lucide-chevron-left" class="size-3" />
          <span class="text-neutral-600">المتجر</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-hearth-ink)] sm:text-5xl">المتجر</h1>
        <p class="mt-2 max-w-xl text-neutral-600">كل قطعة، في مكان واحد. الدفع عند الاستلام — ادفع عندما تصل إلى بابك.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex gap-8">
        <aside class="hidden w-64 shrink-0 lg:block">
          <div class="hearth-card sticky top-24 space-y-6 p-5">
            <div>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">بحث</h3>
              <form @submit.prevent="props.onSearchSubmit">
                <HearthInput :model-value="props.searchInput" placeholder="ابحث عن المنتجات..." icon="i-lucide-search" @update:model-value="props.onUpdateSearchInput" />
              </form>
            </div>
            <div class="h-px bg-neutral-100" />
            <div>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">الفئات</h3>
              <div class="space-y-1">
                <button
                  v-for="opt in props.categoryOptions"
                  :key="opt.value"
                  class="flex w-full items-center justify-between rounded-xl px-4 py-2 text-sm font-medium transition-all"
                  :class="activeCategory === opt.value ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'"
                  @click="props.onUpdateQuery({ category: opt.value })"
                >
                  <span>{{ opt.label }}</span>
                  <Icon v-if="activeCategory === opt.value" name="i-lucide-check" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ التحميل...
          </div>
          <EmptyState v-else-if="!props.data?.items.length" icon="i-lucide-search-x" title="لم يتم العثور على منتجات" description="جرب بحثاً مختلفاً أو امسح عوامل التصفية.">
            <HearthButton to="/catalog" class="mt-4">مسح عوامل التصفية</HearthButton>
          </EmptyState>
          <template v-else>
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
            </div>
            <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
              <button
                v-for="p in props.totalPages"
                :key="p"
                class="tabular flex size-9 items-center justify-center rounded-xl text-sm font-medium transition-colors"
                :class="p === props.currentPage ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 hover:bg-primary-50'"
                @click="props.onUpdateQuery({ page: p })"
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
