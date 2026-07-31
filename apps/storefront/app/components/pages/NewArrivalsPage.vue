<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Minimal (fallback) new-arrivals presentation — gradient hero + newest grid.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div>
    <div class="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute -start-16 -top-16 size-64 rounded-full bg-white/5" />
        <div class="absolute -bottom-12 end-24 size-48 rounded-full bg-white/5" />
      </div>
      <div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <nav class="mb-6 flex items-center gap-2 text-sm text-white/50">
          <NuxtLink to="/" class="transition-colors hover:text-white">الرئيسية</NuxtLink>
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
          <span class="text-white/80">وصل حديثاً</span>
        </nav>
        <h1 class="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">وصل للتو</h1>
        <p class="mt-3 max-w-xl text-white/70">إضافات جديدة إلى المتجر. كن أول من يحصل عليها — الدفع عند الاستلام.</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        <TemplateSection v-for="p in props.data.items" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
      <EmptyState v-else icon="i-lucide-package-search" title="لا يوجد جديد بعد" description="تحقق مرة أخرى قريباً للاطلاع على أحدث المنتجات." />
    </section>
  </div>
</template>
