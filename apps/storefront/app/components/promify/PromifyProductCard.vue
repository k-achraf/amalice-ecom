<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Promify product card — bordered outline card with aspect-square image,
// badge, wishlist heart (hover), name, star rating, price. The signature
// Promify look: rounded-lg, hover shadow lift, amber star, the primary-blue
// accent on hover. Amalice's Product has no originalPrice/rating, so those
// elements are omitted gracefully (not faked).
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))

// Wishlist (client-side) — toggle in the shared wishlist state.
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
    class="promify-card group block overflow-hidden transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden bg-neutral-100">
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
      <!-- Stock badge -->
      <span
        v-if="product.stockQuantity === 0"
        class="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white"
      >Sold out</span>
      <span
        v-else-if="product.bestSeller"
        class="absolute left-3 top-3 rounded-full bg-primary-600 px-2.5 py-0.5 text-xs font-semibold text-white"
      >Best seller</span>
      <!-- Wishlist heart -->
      <button
        class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon
          :name="inWishlist ? 'i-lucide-heart' : 'i-lucide-heart'"
          class="size-4"
          :class="inWishlist ? 'text-red-500' : 'text-neutral-400'"
        />
      </button>
    </div>

    <!-- Info -->
    <div class="p-4">
      <h3 class="line-clamp-2 text-sm font-medium text-neutral-800">{{ product.name }}</h3>
      <div class="mt-2 flex items-center gap-2">
        <PriceDisplay :amount-cents="product.priceCents" class="text-base font-bold text-neutral-900" />
      </div>
    </div>
  </NuxtLink>
</template>
