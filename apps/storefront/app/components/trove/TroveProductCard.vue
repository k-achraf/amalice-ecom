<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Trove product card — the signature motif: the photo is cropped to a
// perfect circle and mounted, charm-like, on a sharp square backdrop
// (.trove-mount) inside the card's own sharp frame (.trove-card). No other
// template mixes radius languages like this — every other shape on the
// card (the card itself, the badges, the button) stays sharp; only the
// photo gets to be round. A small teal outline "collected" tag stands in
// for a best-seller callout.
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
    class="trove-card group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <!-- Pegboard mount: sharp square backdrop holding the circular photo -->
    <div class="trove-mount aspect-square p-7">
      <div class="trove-photo relative aspect-square w-full">
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
        <div v-else class="flex size-full items-center justify-center bg-neutral-100">
          <Icon name="i-lucide-image" class="size-8 text-neutral-300" />
        </div>
      </div>

      <span v-if="product.stockQuantity === 0" class="absolute left-3 top-3 rounded bg-black/50 px-2.5 py-1 text-[11px] font-bold uppercase text-white backdrop-blur-sm">Sold out</span>
      <span v-else-if="product.bestSeller" class="trove-tag absolute left-3 top-3 !bg-white/90 backdrop-blur-sm">Collected</span>
      <button
        class="absolute right-3 top-3 flex size-8 items-center justify-center rounded bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-600' : 'text-neutral-400'" />
      </button>
    </div>

    <!-- Info -->
    <div class="border-t border-neutral-200 p-4">
      <h3 class="line-clamp-2 text-sm font-medium text-[var(--color-trove-ink)]">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1.5 block text-base font-bold text-primary-700" />
    </div>
  </NuxtLink>
</template>
