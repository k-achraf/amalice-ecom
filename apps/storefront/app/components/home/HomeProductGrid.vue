<script setup lang="ts">
import type { Product } from '@amalice/shared'

// A reusable product grid section — used for "new arrivals" / "best sellers".
// The card itself is template-overridable via <TemplateSection name="ProductCard">,
// so each template's home grid uses that template's card look without this
// section needing a per-template copy.
defineProps<{ title: string; products: Product[]; viewAllTo?: string }>()
</script>

<template>
  <section v-if="products?.length" class="mx-auto max-w-7xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-2xl font-semibold">{{ title }}</h2>
      <Button v-if="viewAllTo" :to="viewAllTo" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-left">عرض الكل</Button>
    </div>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <TemplateSection v-for="p in products" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
    </div>
  </section>
</template>
