<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Drop product card — flat panel on black, thin white/10 border that flips
// to the accent color on hover (no shadow, no lift — just contrast),
// rotated sticker tags for sold-out/best-seller, custom wishlist heart.
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
    class="group block border border-white/10 bg-[#171717] transition-colors duration-150 hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden border-b border-white/10 bg-neutral-900">
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
      <span v-if="product.stockQuantity === 0" class="sticker sticker-dark absolute left-2 top-2">Sold out</span>
      <span v-else-if="product.bestSeller" class="sticker absolute left-2 top-2">Best seller</span>
      <button
        class="absolute right-2 top-2 flex size-8 items-center justify-center border border-white/20 bg-black/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-500' : 'text-white'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-3">
      <h3 class="line-clamp-2 text-sm font-bold text-white">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1 block text-base font-bold text-primary-500" />
    </div>
  </NuxtLink>
</template>
