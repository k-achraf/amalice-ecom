<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Promify catalog — balanced SaaS-standard layout: a blue header band with
// breadcrumb + title, then a single TOP filter bar (inline search + category
// select, side by side) followed by a 4-col grid and numbered square
// pagination buttons. No sidebar — distinct from Minimal's left rail.
// Promify palette resolves under .tpl-promify.
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
    <!-- Blue header band with breadcrumb + title -->
    <div class="bg-gradient-to-r from-primary-600 to-primary-900">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-white/60">
          <NuxtLink to="/" class="transition-colors hover:text-white">الرئيسية</NuxtLink>
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
          <span class="text-white/90">المتجر</span>
        </nav>
        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">تسوق كل المنتجات</h1>
        <p class="mt-2 max-w-xl text-white/70">تصفح التشكيلة الكاملة. الدفع عند الاستلام — ادفع عند وصول طلبك إلى بابك.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <!-- Top filter bar — inline search + category select, side by side -->
      <div class="mb-8 flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <form class="flex-1" @submit.prevent="props.onSearchSubmit">
          <PromifyInput
            :model-value="props.searchInput"
            placeholder="ابحث عن المنتجات..."
            icon="i-lucide-search"
            class="w-full"
            @update:model-value="props.onUpdateSearchInput"
          />
        </form>
        <PromifySelect
          :model-value="activeCategory"
          :items="props.categoryOptions"
          class="sm:w-56"
          @update:model-value="(v: string) => props.onUpdateQuery({ category: v })"
        />
      </div>

      <!-- Grid -->
      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ التحميل...
      </div>
      <EmptyState
        v-else-if="!props.data?.items.length"
        icon="i-lucide-package-search"
        title="لم يتم العثور على منتجات"
        description="جرّب بحثاً مختلفاً أو امسح عوامل التصفية."
      >
        <PromifyButton to="/catalog" class="mt-4">مسح عوامل التصفية</PromifyButton>
      </EmptyState>
      <template v-else>
        <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
          <TemplateSection
            v-for="product in props.data.items"
            :key="product.id"
            name="ProductCard"
            :section-props="{ product }"
          />
        </div>

        <!-- Numbered square pagination -->
        <div v-if="props.totalPages > 1" class="mt-12 flex items-center justify-center gap-2">
          <PromifyButton
            v-for="p in props.totalPages"
            :key="p"
            :color="p === props.currentPage ? 'primary' : 'neutral'"
            :variant="p === props.currentPage ? 'solid' : 'ghost'"
            size="sm"
            square
            class="tabular"
            @click="props.onUpdateQuery({ page: p })"
          >
            {{ p }}
          </PromifyButton>
        </div>
      </template>
    </section>
  </div>
</template>
