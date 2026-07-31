<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Impulse catalog — "the offer wall". Funnel rules applied: countdown at
// the top, one centered promise headline, a single search field (no filter
// sidebar maze), the card grid (each card is a mini ad with its own Order
// Now pill), and a trust row before the footer.
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
  <div class="bg-neutral-50">
    <div class="border-b border-neutral-200 bg-white py-3">
      <ImpulseCountdown label="تنتهي عروض اليوم خلال" />
    </div>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="mb-8 space-y-4 text-center">
        <h1 class="font-display text-3xl font-black uppercase text-neutral-900 sm:text-4xl">
          اختر عرضك. <span class="marker">ادفع عند الاستلام.</span>
        </h1>
        <form class="mx-auto flex max-w-md gap-2" @submit.prevent="props.onSearchSubmit">
          <ImpulseInput
            :model-value="props.searchInput"
            placeholder="عمّ تبحث؟"
            icon="i-lucide-search"
            class="flex-1"
            @update:model-value="props.onUpdateSearchInput"
          />
          <ImpulseButton type="submit" size="md">بحث</ImpulseButton>
        </form>
        <!-- One-tap category pills — chips, not a sidebar. -->
        <div v-if="props.categoryOptions.length" class="flex flex-wrap items-center justify-center gap-2">
          <button
            class="rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
            :class="!props.routeQuery.category ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'"
            @click="props.onUpdateQuery({ category: undefined, page: undefined })"
          >
            الكل
          </button>
          <button
            v-for="option in props.categoryOptions"
            :key="option.value"
            class="rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
            :class="props.routeQuery.category === option.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'"
            @click="props.onUpdateQuery({ category: option.value, page: undefined })"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ تحميل العروض...
      </div>

      <template v-else-if="props.data?.items.length">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>

        <div v-if="props.totalPages > 1" class="mt-10 flex items-center justify-center gap-2">
          <ImpulseButton
            variant="outline"
            color="neutral"
            size="sm"
            square
            :disabled="props.currentPage <= 1"
            aria-label="الصفحة السابقة"
            @click="props.onUpdateQuery({ page: props.currentPage - 1 })"
          >
            <Icon name="i-lucide-chevron-right" class="size-4" />
          </ImpulseButton>
          <span class="px-2 text-sm font-bold text-neutral-600">{{ props.currentPage }} / {{ props.totalPages }}</span>
          <ImpulseButton
            variant="outline"
            color="neutral"
            size="sm"
            square
            :disabled="props.currentPage >= props.totalPages"
            aria-label="الصفحة التالية"
            @click="props.onUpdateQuery({ page: props.currentPage + 1 })"
          >
            <Icon name="i-lucide-chevron-left" class="size-4" />
          </ImpulseButton>
        </div>
      </template>

      <div v-else class="py-24 text-center">
        <Icon name="i-lucide-package-search" class="mx-auto mb-3 size-10 text-neutral-300" />
        <p class="font-bold text-neutral-900">لا توجد نتائج مطابقة.</p>
        <p class="mb-4 text-sm text-neutral-500">جرّب بحثاً مختلفاً.</p>
        <ImpulseButton size="md" @click="props.onUpdateQuery({ q: undefined, category: undefined, page: undefined })">عرض الكل</ImpulseButton>
      </div>

      <div class="mt-12">
        <ImpulseTrustRow />
      </div>
    </section>
  </div>
</template>
