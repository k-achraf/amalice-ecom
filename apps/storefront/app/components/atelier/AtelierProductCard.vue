<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Atelier product card — a dark velvet image mat (jewelry photographs best
// on a dark backdrop, not white), rounded card, soft glow shadow that
// blooms on hover, circular wishlist heart, ring-badge tags. No @nuxt/ui.
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
    class="glow-card group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
  >
    <!-- Image on a velvet mat -->
    <div class="relative aspect-square overflow-hidden bg-[var(--color-atelier-velvet)]">
      <NuxtImg
        v-if="cardImage"
        :src="cardImage"
        :alt="product.name"
        class="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
        width="400"
        height="400"
        loading="lazy"
        format="webp"
      />
      <span v-if="product.stockQuantity === 0" class="ring-badge absolute left-3 top-3 !border-white/30 !bg-black/40 !text-white backdrop-blur-sm">Sold out</span>
      <span v-else-if="product.bestSeller" class="ring-badge absolute left-3 top-3">Best seller</span>
      <button
        class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-600' : 'text-neutral-500'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-4 text-center">
      <h3 class="line-clamp-2 text-sm font-medium text-[var(--color-atelier-ink)]">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1 block text-base font-semibold text-primary-600" />
    </div>
  </NuxtLink>
</template>
