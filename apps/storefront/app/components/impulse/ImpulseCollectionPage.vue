<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Impulse collection — a category funnel wall: countdown, category promise
// headline, a single compact price filter, the ad-card grid, trust row.
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
  props.onUpdateMinPrice(v === '' ? undefined : Number(v))
}
function onMaxInput(v: string) {
  props.onUpdateMaxPrice(v === '' ? undefined : Number(v))
}
</script>

<template>
  <div class="bg-neutral-50">
    <div class="border-b border-neutral-200 bg-white py-3">
      <ImpulseCountdown label="تنتهي عروض اليوم خلال" />
    </div>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="mb-8 space-y-3 text-center">
        <ImpulseBadge color="neutral" variant="subtle">فئة</ImpulseBadge>
        <h1 class="font-display text-3xl font-black uppercase text-neutral-900 sm:text-4xl">
          {{ props.category?.name ?? 'الفئة' }} — <span class="marker">الدفع عند الاستلام</span>
        </h1>
        <p v-if="props.category?.description" class="mx-auto max-w-lg text-sm text-neutral-600">{{ props.category.description }}</p>

        <form class="mx-auto flex max-w-sm items-end justify-center gap-2" @submit.prevent="props.onApplyPrice">
          <div class="flex-1 text-start">
            <label class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">الحد الأدنى</label>
            <ImpulseInput :model-value="props.minPrice !== undefined ? String(props.minPrice) : ''" type="number" placeholder="0" @update:model-value="onMinInput" />
          </div>
          <div class="flex-1 text-start">
            <label class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">الحد الأقصى</label>
            <ImpulseInput :model-value="props.maxPrice !== undefined ? String(props.maxPrice) : ''" type="number" placeholder="999" @update:model-value="onMaxInput" />
          </div>
          <ImpulseButton type="submit" variant="outline" color="neutral" size="md">تصفية</ImpulseButton>
        </form>
      </div>

      <div v-if="props.pending" class="flex items-center justify-center py-24 text-neutral-400">
        <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ التحميل...
      </div>

      <template v-else-if="props.data?.items.length">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
        </div>

        <div v-if="props.totalPages > 1" class="mt-10 flex items-center justify-center gap-2">
          <ImpulseButton variant="outline" color="neutral" size="sm" square :disabled="props.currentPage <= 1" aria-label="الصفحة السابقة" @click="props.onPaginate(props.currentPage - 1)">
            <Icon name="i-lucide-chevron-right" class="size-4" />
          </ImpulseButton>
          <span class="px-2 text-sm font-bold text-neutral-600">{{ props.currentPage }} / {{ props.totalPages }}</span>
          <ImpulseButton variant="outline" color="neutral" size="sm" square :disabled="props.currentPage >= props.totalPages" aria-label="الصفحة التالية" @click="props.onPaginate(props.currentPage + 1)">
            <Icon name="i-lucide-chevron-left" class="size-4" />
          </ImpulseButton>
        </div>
      </template>

      <div v-else class="py-24 text-center">
        <Icon name="i-lucide-package-search" class="mx-auto mb-3 size-10 text-neutral-300" />
        <p class="font-bold text-neutral-900">لا شيء ضمن هذا النطاق.</p>
        <ImpulseButton to="/catalog" size="md" class="mt-4">شاهد كل العروض</ImpulseButton>
      </div>

      <div class="mt-12">
        <ImpulseTrustRow />
      </div>
    </section>
  </div>
</template>
