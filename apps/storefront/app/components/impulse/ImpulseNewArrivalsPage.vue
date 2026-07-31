<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Impulse new arrivals — "just dropped" framed as fresh offers, same
// funnel wall as the catalog.
const props = defineProps<{
  data: ProductListResponse | null
}>()
</script>

<template>
  <div class="bg-neutral-50">
    <div class="border-b border-neutral-200 bg-white py-3">
      <ImpulseCountdown label="ينتهي سعر الإطلاق خلال" />
    </div>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="mb-8 space-y-2 text-center">
        <ImpulseBadge color="primary" variant="subtle">
          <Icon name="i-lucide-sparkles" class="size-3.5" />
          وصل حديثاً
        </ImpulseBadge>
        <h1 class="font-display text-3xl font-black uppercase text-neutral-900 sm:text-4xl">
          عروض جديدة — <span class="marker">كن أول من يطلب</span>
        </h1>
      </div>

      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
      </div>
      <div v-else class="py-24 text-center">
        <Icon name="i-lucide-package" class="mx-auto mb-3 size-10 text-neutral-300" />
        <p class="font-bold text-neutral-900">لا يوجد جديد حالياً.</p>
        <ImpulseButton to="/catalog" size="md" class="mt-4">شاهد كل العروض</ImpulseButton>
      </div>

      <div class="mt-12">
        <ImpulseTrustRow />
      </div>
    </section>
  </div>
</template>
