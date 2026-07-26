<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Boutique product card — refined, no border by default, generous padding,
// larger image aspect, square corners (!rounded-none). The luxury convention:
// let whitespace frame the product, not a box.
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug}`"
    class="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
  >
    <div class="aspect-[4/5] overflow-hidden bg-elevated">
      <NuxtImg
        v-if="cardImage"
        :src="cardImage"
        :alt="product.name"
        class="size-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
        width="400"
        height="500"
        loading="lazy"
        format="webp"
      />
    </div>
    <!-- Thin divider line separates the image from the caption -->
    <div class="mx-auto mt-4 h-px w-8 bg-default transition-colors group-hover:bg-muted" />
    <div class="px-1 py-4 text-center">
      <p class="text-sm font-normal tracking-wide text-highlighted">{{ product.name }}</p>
      <PriceDisplay :amount-cents="product.priceCents" class="price-accent mt-1 text-sm font-light" />
      <p v-if="product.stockQuantity === 0" class="mt-1 text-xs uppercase tracking-widest text-error">Sold out</p>
    </div>
  </NuxtLink>
</template>
