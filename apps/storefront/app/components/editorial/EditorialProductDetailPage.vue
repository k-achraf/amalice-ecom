<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Editorial PDP — full-width magazine spread. Gallery left, bold headline
// overlapping, story-style description, big pull-quote reviews. Distinct from
// minimal's clean 2-col split.
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
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
</script>

<template>
  <div v-if="props.product" class="bg-default">
    <!-- Magazine masthead with breadcrumbs -->
    <div class="border-b border-default">
      <div class="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
        <NuxtLink to="/" class="hover:text-highlighted">Home</NuxtLink> /
        <NuxtLink to="/catalog" class="hover:text-highlighted">Shop</NuxtLink> /
        <span class="text-highlighted">{{ props.product.name }}</span>
      </div>
    </div>

    <!-- Spread: oversized gallery left, story right -->
    <section class="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 sm:py-20 lg:grid-cols-12">
      <!-- AI landing page image — replaces the gallery+description when the
      merchant has generated and enabled one (see landing-page.ts). -->
      <div v-if="props.landingPageImageUrl" class="lg:col-span-7">
        <img :src="props.landingPageImageUrl" :alt="props.product.name" class="w-full rounded-sm" />
      </div>
      <div v-else class="lg:col-span-7">
        <div class="aspect-[4/5] overflow-hidden rounded-sm bg-elevated">
          <NuxtImg v-if="props.galleryImages.length" :src="props.galleryImages[props.activeImageIndex]?.url" :alt="props.galleryImages[props.activeImageIndex]?.alt" class="size-full object-cover" width="800" height="1000" loading="eager" format="webp" />
        </div>
        <div v-if="props.galleryImages.length > 1" class="mt-3 flex gap-2">
          <button v-for="(img, i) in props.galleryImages" :key="i" class="size-20 overflow-hidden rounded-sm border-2" :class="i === props.activeImageIndex ? 'border-highlighted' : 'border-transparent'" @click="props.onSelectImage(i)">
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
          </button>
        </div>
      </div>

      <div class="lg:col-span-5">
        <p v-if="props.product.category" class="kicker">{{ props.product.category }}</p>
        <h1 class="mt-2 text-4xl font-bold leading-none tracking-tight text-highlighted sm:text-5xl">{{ props.product.name }}</h1>

        <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="mt-3 flex items-center gap-2 text-sm">
          <span class="font-medium">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
          <div class="flex">
            <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-warning' : 'text-muted'" class="size-4" />
          </div>
        </div>

        <div class="mt-5 flex items-baseline gap-3">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-bold" />
          <span v-if="!props.inStock" class="lozenge" style="background-color: var(--color-error-50); color: var(--color-error-700);">Sold out</span>
        </div>

        <div v-if="props.product.description && !props.landingPageImageUrl" class="product-description-html mt-6 text-lg leading-relaxed text-muted" v-html="sanitizeDescriptionHtml(props.product.description)" />

        <div v-if="props.offers?.length" class="mt-6 space-y-2">
          <button
            v-for="offer in props.offers"
            :key="offer.id"
            type="button"
            class="flex w-full items-center justify-between border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors"
            :class="props.selectedOfferId === offer.id ? 'border-highlighted bg-highlighted text-inverted' : 'border-default hover:border-highlighted'"
            @click="props.onSelectOffer?.(offer)"
          >
            <span>
              <template v-if="offer.type === 'FixedBundlePrice'">Buy {{ offer.requiredQuantity }} for <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
              <template v-else-if="offer.type === 'BuyXGetYFree'">Buy {{ offer.requiredQuantity }}, get {{ offer.freeQuantity }} free</template>
              <template v-else>Buy {{ offer.requiredQuantity }}, free shipping</template>
            </span>
            <Icon v-if="props.selectedOfferId === offer.id" name="i-lucide-check" class="size-4" />
          </button>
        </div>

        <div v-for="(values, key) in props.variantOptions" :key="key" class="mt-6 space-y-2">
          <p class="text-xs font-semibold text-muted">{{ key }}</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="val in values" :key="val" class="border-2 px-4 py-2 text-sm font-medium transition-colors" :class="props.selectedVariant?.attributes[key] === val ? 'border-highlighted bg-highlighted text-inverted' : 'border-default hover:border-highlighted'" @click="props.onSelectVariantByKey(key, val)">{{ val }}</button>
          </div>
        </div>

        <!-- Cart mode -->
        <div v-if="props.displayCart !== false" class="mt-8 flex items-center gap-3">
          <EditorialQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
          <EditorialButton :disabled="!props.inStock" size="lg" color="primary" class="flex-1 !bg-highlighted !text-inverted hover:!bg-highlighted/80" @click="props.onAddToCart">{{ props.inStock ? 'Add to bag' : 'Sold out' }}</EditorialButton>
        </div>
        <p v-if="props.displayCart !== false && props.added" class="mt-3 text-sm text-success">Added to bag.</p>

        <!-- Lead form mode -->
        <div v-if="props.displayCart === false && props.inStock" class="mt-8 border-l-4 border-highlighted pl-5 space-y-4">
          <div>
            <p class="text-xs font-semibold text-muted">Order Now</p>
            <p class="text-sm text-muted">Cash on delivery — pay when it arrives.</p>
          </div>
          <EditorialLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
          <div class="flex items-center gap-3">
            <EditorialQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
            <EditorialButton block size="lg" :loading="props.leadPlacing" class="!bg-highlighted !text-inverted hover:!bg-highlighted/80" @click="props.onSubmitLead">Place order</EditorialButton>
          </div>
          <p v-if="props.leadError" class="text-sm text-error">{{ props.leadError }}</p>
        </div>
      </div>
    </section>

    <!-- Reviews as pull quotes -->
    <section v-if="props.reviewData && props.reviewData.items.length" class="border-t border-default bg-elevated py-16">
      <div class="mx-auto max-w-4xl space-y-10 px-4">
        <h2 class="text-center text-3xl font-bold tracking-tight">What readers say</h2>
        <blockquote v-for="review in props.reviewData.items" :key="review.id" class="border-l-4 border-highlighted pl-6">
          <p v-if="review.body" class="text-xl italic leading-relaxed text-highlighted">"{{ review.body }}"</p>
          <footer class="mt-3 text-sm font-semibold text-muted">— {{ review.customerName ?? 'Verified buyer' }}</footer>
        </blockquote>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-6xl px-4 py-16">
      <h2 class="mb-6 text-2xl font-bold tracking-tight">More from the edit</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
