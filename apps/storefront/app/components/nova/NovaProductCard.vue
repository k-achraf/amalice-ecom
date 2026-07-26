<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Nova product card — thick bordered card, hard offset shadow that grows on
// hover (the card "lifts"), rotated sticker tags for sold-out/best-seller,
// custom wishlist heart button. No @nuxt/ui.
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
    class="group block border-2 border-black bg-white shadow-[var(--shadow-nova-sm)] transition-all duration-150 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[var(--shadow-nova-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden border-b-2 border-black bg-zinc-100">
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
      <span v-if="product.stockQuantity === 0" class="sticker sticker-pop absolute left-2 top-2">Sold out</span>
      <span v-else-if="product.bestSeller" class="sticker absolute left-2 top-2">Best seller</span>
      <button
        class="absolute right-2 top-2 flex size-8 items-center justify-center border-2 border-black bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-[var(--color-nova-pop)]' : 'text-black'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-3">
      <h3 class="line-clamp-2 text-sm font-bold text-black">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1 block text-base font-bold text-black" />
    </div>
  </NuxtLink>
</template>
