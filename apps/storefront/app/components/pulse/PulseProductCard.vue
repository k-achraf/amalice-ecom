<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Pulse product card — a white glow-card with the glossy top-edge
// highlight, rounded-2xl image crop, colorful spec-chip tags, circular
// wishlist heart. No @nuxt/ui.
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
    class="glow-card group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden bg-neutral-50 p-3">
      <NuxtImg
        v-if="cardImage"
        :src="cardImage"
        :alt="product.name"
        class="size-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
        width="400"
        height="400"
        loading="lazy"
        format="webp"
      />
      <span v-if="product.stockQuantity === 0" class="absolute left-3 top-3 rounded-full bg-neutral-900/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">Sold out</span>
      <span v-else-if="product.bestSeller" class="spec-chip absolute left-3 top-3">Best seller</span>
      <button
        class="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-[var(--shadow-pulse-sm)] backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
        @click.prevent="toggleWishlist"
      >
        <Icon name="i-lucide-heart" class="size-4" :class="inWishlist ? 'text-primary-600' : 'text-neutral-400'" />
      </button>
    </div>

    <!-- Info -->
    <div class="p-4">
      <h3 class="line-clamp-2 text-sm font-medium text-neutral-900">{{ product.name }}</h3>
      <PriceDisplay :amount-cents="product.priceCents" class="mt-1.5 block text-base font-semibold text-primary-600" />
      <!-- Spec-chip row — the recurring glossy gadget-spec callout, echoed at card scale -->
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <span class="spec-chip !py-0.5 !text-[10px]">
          <Icon name="i-lucide-truck" class="size-3" /> Free ship
        </span>
        <span v-if="product.category" class="spec-chip !py-0.5 !text-[10px]">{{ product.category }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
