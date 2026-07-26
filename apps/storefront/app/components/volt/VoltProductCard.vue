<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Volt product card — hairline-bordered panel, flat (no ambient shadow), a
// tight cyan glow outline on hover instead, bracket spec-badges for
// sold-out/best-seller, tabular monospace price. No @nuxt/ui.
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
    class="group block overflow-hidden rounded-md border border-white/10 bg-[#0c1113] transition-all duration-150 hover:border-primary-400/50 hover:shadow-[var(--shadow-volt-glow)] focus-visible:outline-none focus-visible:border-primary-400/50 focus-visible:shadow-[var(--shadow-volt-glow)]"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden border-b border-white/10 bg-black">
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
      <span v-if="product.stockQuantity === 0" class="spec-badge absolute left-2 top-2 rounded-md bg-black/80 px-1.5 py-0.5 text-red-400">Sold out</span>
      <span v-else-if="product.bestSeller" class="spec-badge absolute left-2 top-2 rounded-md bg-black/80 px-1.5 py-0.5">Best seller</span>
      <button
        class="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md border border-white/10 bg-black/80 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-400' : 'text-white/60'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-3">
      <h3 class="line-clamp-2 text-sm text-white">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="font-mono-spec mt-1 block text-base text-primary-400" />
    </div>
  </NuxtLink>
</template>
