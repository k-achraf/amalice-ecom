<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Hearth product card — the signature "framed photo" motif: the image sits
// inside a thick off-white/cream mat before the card's own rounded-xl
// edge, echoing a framed print. Barely-there grounded shadow, no glow. A
// small sage "material swatch" tag stands in for a best-seller/new callout.
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
    class="frame-card group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
  >
    <!-- Framed photo: cream mat around the image -->
    <div class="frame-mat relative">
      <div class="frame-mat-inner relative aspect-square bg-neutral-100">
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
        <span v-if="product.stockQuantity === 0" class="absolute left-2 top-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">Sold out</span>
        <span v-else-if="product.bestSeller" class="swatch-tag absolute left-2 top-2 !bg-white/90 backdrop-blur-sm">Best seller</span>
        <button
          class="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
          @click.prevent="toggleWishlist"
        >
          <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-600' : 'text-neutral-400'" />
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="p-4">
      <h3 class="line-clamp-2 text-sm font-medium text-[var(--color-hearth-ink)]">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1.5 block text-base font-semibold text-primary-600" />
    </div>
  </NuxtLink>
</template>
