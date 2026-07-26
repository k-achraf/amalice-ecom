<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Editorial product card — image-dominant, overlay caption. The image fills
// the card; name/price sit in a gradient at the bottom. Distinct from Minimal's
// bordered card-with-below-caption. ADS tokens (editorial.css) + PriceDisplay;
// the "Sold out" tag renders as an ADS lozenge, not a Nuxt UI badge.
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug}`"
    class="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
    <NuxtImg
      v-if="cardImage"
      :src="cardImage"
      :alt="product.name"
      class="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      width="400"
      height="533"
      loading="lazy"
      format="webp"
    />
    <!-- Out-of-stock veil -->
    <div v-if="product.stockQuantity === 0" class="absolute inset-0 bg-black/40" />
    <!-- Overlay caption -->
    <div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4">
      <span v-if="product.stockQuantity === 0" class="lozenge mb-2 w-fit !bg-white/90 !text-neutral-900">Sold out</span>
      <p class="text-sm font-semibold text-white drop-shadow-sm">{{ product.name }}</p>
      <PriceDisplay :amount-cents="product.priceCents" class="text-sm text-white/90 drop-shadow-sm" />
    </div>
  </NuxtLink>
</template>
