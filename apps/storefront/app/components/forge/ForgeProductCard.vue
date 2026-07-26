<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Forge product card — thick bordered card, no shadow (border-color shift +
// tiny lift on hover carries the interaction instead), sticker tags for
// sold-out/best-seller, a boxed SKU label, custom wishlist heart button. No
// @nuxt/ui.
const props = defineProps<{ product: Product }>()
const cardImage = computed(() => resolveImageUrl(props.product.imageUrl))
const skuLabel = computed(() => `SKU-${props.product.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`)

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
    class="group block border-[3px] border-[var(--color-forge-ink)] bg-white transition-all duration-150 hover:-translate-y-1 hover:border-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <!-- Image -->
    <div class="relative aspect-square overflow-hidden border-b-[3px] border-[var(--color-forge-ink)] bg-neutral-100">
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
      <span v-if="product.stockQuantity === 0" class="sticker sticker-danger absolute left-2 top-2">Sold out</span>
      <span v-else-if="product.bestSeller" class="sticker absolute left-2 top-2">Best seller</span>
      <!-- SKU pinned top-right — always visible, not buried in the body copy -->
      <span class="sku-tag absolute right-2 top-2 bg-white/95">{{ skuLabel }}</span>
    </div>

    <!-- Info -->
    <div class="p-3">
      <h3 class="line-clamp-2 text-sm font-bold text-[var(--color-forge-ink)]">{{ product.name }}</h3>
      <div class="mt-1.5 flex items-center justify-between gap-2">
        <PriceDisplay :amount-cents="product.priceCents" class="block text-base font-bold text-[var(--color-forge-ink)]" />
        <button
          class="flex size-7 shrink-0 items-center justify-center border-2 border-[var(--color-forge-ink)]/20 transition-colors hover:border-[var(--color-forge-ink)]"
          :aria-label="inWishlist ? 'Remove from wishlist' : 'Add to wishlist'"
          @click.prevent="toggleWishlist"
        >
          <Icon name="i-lucide-heart" class="size-3.5" :class="inWishlist ? 'text-red-600' : 'text-[var(--color-forge-ink)]/60'" />
        </button>
      </div>
    </div>
  </NuxtLink>
</template>
