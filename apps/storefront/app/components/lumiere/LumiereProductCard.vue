<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Lumiere product card — no card border/box at all; an oversized sharp-
// cornered photo, zero radius, with the caption sitting below a single thin
// rule — the editorial "photo + caption line" index-card treatment, not a
// bordered box. No shadow anywhere. Hierarchy comes from the crimson
// sold-out/best-seller tag, scale, and a hover image zoom, never elevation.
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))

const wishlist = useState<string[]>('wishlist', () => [])
const inWishlist = computed(() => wishlist.value.includes(props.product.id))
function toggleWishlist() {
  if (inWishlist.value) {
    wishlist.value = wishlist.value.filter((id) => id !== props.product.id)
  } else {
    wishlist.value = [...wishlist.value, props.product.id]
  }
}
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug}`"
    class="group block bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
  >
    <!-- Image — no border/box, zero radius, oversized within its column -->
    <div class="relative aspect-[4/5] overflow-hidden bg-neutral-100">
      <NuxtImg
        v-if="cardImage"
        :src="cardImage"
        :alt="product.name"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
        width="400"
        height="500"
        loading="lazy"
        format="webp"
      />
      <span v-if="product.stockQuantity === 0" class="absolute left-0 top-0 bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Sold out</span>
      <span v-else-if="product.bestSeller" class="absolute left-0 top-0 bg-primary-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Best seller</span>
      <button
        class="absolute right-2 top-2 flex size-8 items-center justify-center rounded border border-black/10 bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-600' : 'text-black'" />
      </button>
    </div>

    <!-- Caption — below a single thin rule, never a bordered box -->
    <div class="mt-3 border-t border-black pt-2.5">
      <h3 class="line-clamp-2 text-sm font-medium text-black">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1 block text-base font-bold text-black" />
    </div>
  </NuxtLink>
</template>
