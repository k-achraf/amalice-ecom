<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Bloom product card — a light rounded-3xl card (no dark mat — product
// photos sit straight on white here, unlike Atelier's velvet mat), soft
// glow shadow that blooms on hover, circular wishlist heart, glow-dot tags.
// No @nuxt/ui.
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
    class="glow-card group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden bg-[var(--color-bloom-blush)]">
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
      <span v-if="product.stockQuantity === 0" class="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">Sold out</span>
      <span v-else-if="product.bestSeller" class="glow-dot absolute left-3 top-3 !bg-white/90 backdrop-blur-sm">Best seller</span>
      <button
        class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-500' : 'text-neutral-400'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-4 text-center">
      <h3 class="line-clamp-2 text-sm font-medium text-[var(--color-bloom-ink)]">{{ product.name }}</h3>
      <!-- Decorative swatch-dot row — the recurring "shade options" cue -->
      <div class="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        <span class="size-2.5 rounded-full bg-primary-300 ring-1 ring-white" />
        <span class="size-2.5 rounded-full bg-primary-500 ring-1 ring-white" />
        <span class="size-2.5 rounded-full bg-primary-700 ring-1 ring-white" />
        <span class="size-2.5 rounded-full bg-[var(--color-bloom-ink)]/70 ring-1 ring-white" />
      </div>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1.5 block text-base font-semibold text-primary-600" />
    </div>
  </NuxtLink>
</template>
