<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField, VariantSwatches } from '@amalice/shared'

// Volt PDP — gallery left on a bordered dark panel, spec sheet right:
// bracket-style status badges, tabular monospace price, hairline-bordered
// variant chips. No @nuxt/ui.
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
  // See VariantSwatchesSchema's comment (packages/shared/src/catalog.ts).
  variantSwatches?: VariantSwatches
}

const props = defineProps<{
  product: RichProduct | null
  reviewData: { summary: RatingSummary; items: Review[] } | null
  landingPageImageUrl?: string | null
  galleryImages: { url: string; alt: string }[]
  activeImageIndex: number
  quantity: number
  added: boolean
  selectedVariantId: string | null
  selectedVariant: ProductVariant | null
  effectivePriceCents: number
  effectiveStock: number
  inStock: boolean
  variantOptions: Record<string, Set<string>>
  displayCart?: boolean
  leadFields?: LeadFormField[]
  leadFormData?: Record<string, string>
  leadPlacing?: boolean
  leadError?: string | null
  offers?: ProductOffer[]
  selectedOfferId?: string | null
  onSelectImage: (i: number) => void
  onSelectVariantByKey: (key: string, val: string) => void
  onUpdateQuantity: (v: number) => void
  onAddToCart: () => void
  onSubmitLead?: () => void
  onSelectOffer?: (offer: ProductOffer) => void
}>()

// See VariantSwatchesSchema's comment (packages/shared/src/catalog.ts) — undefined
// for a non-color attribute or a color option with no hex set.
function swatchColor(key: string, val: string): string | undefined {
  return props.product?.variantSwatches?.[key]?.[val]
}
</script>

<template>
  <div v-if="props.product" class="bg-black">
    <div class="border-b border-white/10">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <nav class="font-mono-spec flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <NuxtLink to="/catalog" class="hover:text-white">Shop</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">{{ props.product.name }}</span>
        </nav>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <!-- AI landing page image — replaces the gallery+description when the
      merchant has generated and enabled one (see landing-page.ts). -->
      <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="mb-10 w-full rounded-md border border-white/10" />

      <div class="grid grid-cols-1 gap-10" :class="props.landingPageImageUrl ? '' : 'lg:grid-cols-2'">
      <!-- Gallery -->
      <div v-if="!props.landingPageImageUrl" class="space-y-3">
        <div class="aspect-square overflow-hidden rounded-md border border-white/10 bg-[#0c1113]">
          <NuxtImg
            v-if="props.galleryImages.length"
            :src="props.galleryImages[props.activeImageIndex]?.url"
            :alt="props.galleryImages[props.activeImageIndex]?.alt"
            class="size-full object-cover"
            width="600"
            height="600"
            loading="eager"
            format="webp"
          />
        </div>
        <div v-if="props.galleryImages.length > 1" class="flex gap-2">
          <button
            v-for="(img, i) in props.galleryImages"
            :key="i"
            class="size-16 overflow-hidden rounded-md border transition-colors"
            :class="i === props.activeImageIndex ? 'border-primary-400' : 'border-white/10 hover:border-white/25'"
            @click="props.onSelectImage(i)"
          >
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="64" height="64" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- Spec sheet -->
      <div class="space-y-5">
        <div>
          <p v-if="props.product.category" class="font-mono-spec text-xs uppercase tracking-wide text-white/40">{{ props.product.category }}</p>
          <h1 class="font-display mt-1 text-3xl text-white">{{ props.product.name }}</h1>
        </div>

        <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
          <span class="font-mono-spec font-medium text-white">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
          <div class="flex">
            <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-400' : 'text-white/20'" class="size-4" />
          </div>
          <span class="text-white/40">({{ props.reviewData.summary.count }})</span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="font-mono-spec text-2xl font-bold text-white" />
          <span v-if="!props.inStock" class="spec-badge spec-badge-solid rounded-md bg-red-500 px-2 py-0.5 !text-black">Out of stock</span>
          <span v-else-if="props.effectiveStock <= props.product.lowStockThreshold" class="spec-badge">{{ props.effectiveStock }} left</span>
        </div>

        <div v-if="props.product.description && !props.landingPageImageUrl" class="product-description-html leading-relaxed text-white/60" v-html="sanitizeDescriptionHtml(props.product.description)" />

        <!-- Offers -->
        <div v-if="props.offers?.length" class="space-y-2">
          <button
            v-for="offer in props.offers"
            :key="offer.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md border px-4 py-2.5 text-left font-mono-spec text-xs uppercase tracking-wide transition-colors"
            :class="props.selectedOfferId === offer.id ? 'border-primary-400 bg-primary-400/10 text-primary-400' : 'border-white/10 text-white/70 hover:border-white/25'"
            @click="props.onSelectOffer?.(offer)"
          >
            <span>
              <template v-if="offer.type === 'FixedBundlePrice'">Buy {{ offer.requiredQuantity }} for <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
              <template v-else-if="offer.type === 'BuyXGetYFree'">Buy {{ offer.requiredQuantity }}, get {{ offer.freeQuantity }} free</template>
              <template v-else>Buy {{ offer.requiredQuantity }}, free shipping</template>
            </span>
            <Icon v-if="props.selectedOfferId === offer.id" name="i-lucide-check" class="size-3.5" />
          </button>
        </div>

        <!-- Spec table — label:value monospace rows, reinforcing the spec-sheet read beyond just the gallery/detail split -->
        <div class="font-mono-spec rounded-md border border-white/10 bg-[#0c1113] text-xs text-white/50">
          <div v-if="props.product.category" class="flex justify-between border-b border-white/10 px-4 py-2.5"><span>Category</span><span class="text-white">{{ props.product.category }}</span></div>
          <div class="flex justify-between border-b border-white/10 px-4 py-2.5"><span>Availability</span><span :class="props.inStock ? 'text-primary-400' : 'text-red-400'">{{ props.inStock ? 'In stock' : 'Out of stock' }}</span></div>
          <div class="flex justify-between px-4 py-2.5"><span>Fulfilment</span><span class="text-primary-400">Cash on delivery</span></div>
        </div>

        <!-- Variants -->
        <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-2">
          <p class="font-mono-spec text-xs uppercase tracking-wide text-white/40">{{ key }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="val in values"
              :key="val"
              class="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              :class="props.selectedVariant?.attributes[key] === val
                ? 'border-primary-400 bg-primary-400/10 text-primary-400'
                : 'border-white/10 text-white/70 hover:border-white/25 hover:text-white'"
              @click="props.onSelectVariantByKey(key, val)"
            >
              <span v-if="swatchColor(key, val)" class="me-1.5 inline-block size-3 rounded-full border border-black/15 align-middle" :style="{ backgroundColor: swatchColor(key, val) }" />{{ val }}
            </button>
          </div>
        </div>

        <!-- Cart mode -->
        <div v-if="props.displayCart !== false" class="flex items-center gap-3 pt-2">
          <VoltQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
          <VoltButton :disabled="!props.inStock" icon="i-lucide-shopping-cart" size="lg" class="flex-1" @click="props.onAddToCart">
            {{ props.inStock ? 'Add to cart' : 'Out of stock' }}
          </VoltButton>
        </div>
        <p v-if="props.displayCart !== false && props.added" class="text-sm text-emerald-400">Added to cart.</p>

        <!-- Lead form mode -->
        <div v-if="props.displayCart === false && props.inStock" class="mt-4 space-y-4 rounded-md border border-white/10 bg-[#0c1113] p-5">
          <div class="flex items-center gap-2">
            <Icon name="i-lucide-banknote" class="size-5 text-primary-400" />
            <h3 class="font-display text-base text-white">Order now — cash on delivery</h3>
          </div>
          <VoltLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
          <div class="flex items-center gap-3">
            <VoltQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
            <VoltButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</VoltButton>
          </div>
          <p v-if="props.leadError" class="text-sm text-red-400">{{ props.leadError }}</p>
        </div>
      </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl space-y-6">
        <h2 class="font-display text-2xl text-white">Reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-mono-spec text-3xl font-bold text-white">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
              <div class="flex">
                <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-400' : 'text-white/20'" class="size-4" />
              </div>
            </div>
            <p class="text-sm text-white/40">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
          </div>
          <div class="space-y-4 lg:col-span-2">
            <div v-for="review in props.reviewData.items" :key="review.id" class="border-b border-white/10 pb-4">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= review.rating ? 'text-primary-400' : 'text-white/20'" class="size-3" />
                </div>
                <span class="text-sm font-medium text-white">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-medium text-white">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm text-white/50">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-white/40">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-2xl text-white">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
