<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Polaris-cleanup (SF-19/SF-15): use NuxtImg (webp/lazy/explicit dims to
// prevent CLS) and the images[] relation when present, falling back to the
// denormalized imageUrl. The raw <img> + imageUrl-only path is gone.
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug}`"
    class="group block overflow-hidden rounded-md border border-default bg-default transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-polaris-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <div class="aspect-square overflow-hidden bg-elevated">
      <NuxtImg
        v-if="cardImage"
        :src="cardImage"
        :alt="product.name"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
        width="400"
        height="400"
        loading="lazy"
        format="webp"
      />
    </div>
    <div class="space-y-1 p-3">
      <p class="truncate text-sm font-medium text-highlighted">{{ product.name }}</p>
      <div class="flex items-center justify-between gap-2">
        <PriceDisplay :amount-cents="product.priceCents" class="text-sm" />
        <Badge v-if="product.stockQuantity === 0" color="error" variant="subtle">غير متوفر</Badge>
        <Badge v-else-if="product.stockQuantity <= product.lowStockThreshold" color="warning" variant="subtle">كمية محدودة</Badge>
      </div>
    </div>
  </NuxtLink>
</template>

