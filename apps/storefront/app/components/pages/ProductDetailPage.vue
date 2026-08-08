<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Minimal (fallback) PDP presentation — 2-col split (gallery | info) + reviews
// below + related. The prop contract: the page shell owns product data,
// gallery state, variant selection, cart add, reviews — this just renders.
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
  <main v-if="props.product" class="mx-auto max-w-7xl space-y-8 p-4">
    <nav class="text-sm text-muted">
      <NuxtLink to="/" class="hover:text-highlighted">Home</NuxtLink> /
      <NuxtLink to="/catalog" class="hover:text-highlighted">Shop</NuxtLink> /
      <span>{{ props.product.name }}</span>
    </nav>

    <!-- AI landing page image (packages/shared/src/landing-page.ts) — a
    long-scroll marketing image standing in for the normal gallery +
    description when the merchant has generated and enabled one. The buy
    box below (price, variants, add-to-cart/lead form) is unaffected either
    way — this only replaces the narrative content, never the purchase
    mechanism. -->
    <img
      v-if="props.landingPageImageUrl"
      :src="props.landingPageImageUrl"
      :alt="props.product.name"
      class="w-full rounded-lg"
    />

    <div class="grid grid-cols-1 gap-6" :class="props.landingPageImageUrl ? '' : 'lg:grid-cols-2'">
      <!-- Gallery -->
      <div v-if="!props.landingPageImageUrl" class="space-y-3">
        <div class="aspect-square overflow-hidden rounded-lg bg-elevated">
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
            class="size-16 overflow-hidden rounded-md border-2"
            :class="i === props.activeImageIndex ? 'border-primary' : 'border-default'"
            @click="props.onSelectImage(i)"
          >
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="64" height="64" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- Detail -->
      <div class="space-y-5">
        <div>
          <p v-if="props.product.category" class="text-xs font-medium uppercase tracking-wide text-muted">{{ props.product.category }}</p>
          <h1 class="mt-1 text-3xl font-bold text-highlighted">{{ props.product.name }}</h1>
        </div>

        <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
          <span class="font-medium">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
          <div class="flex">
            <Icon
              v-for="i in 5"
              :key="i"
              name="i-lucide-star"
              :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-warning' : 'text-muted'"
              class="size-4"
            />
          </div>
          <span class="text-muted">({{ props.reviewData.summary.count }})</span>
        </div>

        <div class="flex items-center gap-3">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-2xl font-semibold" />
          <Badge v-if="!props.inStock" color="error" variant="subtle">Out of stock</Badge>
          <Badge v-else-if="props.effectiveStock <= props.product.lowStockThreshold" color="warning" variant="subtle">
            Only {{ props.effectiveStock }} left
          </Badge>
        </div>

        <div v-if="props.product.description && !props.landingPageImageUrl" class="product-description-html text-muted" v-html="sanitizeDescriptionHtml(props.product.description)" />

        <!-- Offers — pick a card to set quantity + pricing to what it needs -->
        <div v-if="props.offers?.length" class="space-y-2">
          <button
            v-for="offer in props.offers"
            :key="offer.id"
            type="button"
            class="flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-colors"
            :class="props.selectedOfferId === offer.id ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
            @click="props.onSelectOffer?.(offer)"
          >
            <span class="text-sm font-medium">
              <template v-if="offer.type === 'FixedBundlePrice'">Buy {{ offer.requiredQuantity }} for <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
              <template v-else-if="offer.type === 'BuyXGetYFree'">Buy {{ offer.requiredQuantity }}, get {{ offer.freeQuantity }} free</template>
              <template v-else>Buy {{ offer.requiredQuantity }}, free shipping</template>
            </span>
            <Icon v-if="props.selectedOfferId === offer.id" name="i-lucide-check-circle" class="size-5 text-primary" />
          </button>
        </div>

        <!-- Variants -->
        <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-2">
          <p class="text-sm font-medium capitalize">{{ key }}</p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="val in values"
              :key="val"
              size="sm"
              :variant="props.selectedVariant?.attributes[key] === val ? 'solid' : 'outline'"
              color="neutral"
              @click="props.onSelectVariantByKey(key, val)"
            >
              {{ val }}
            </Button>
          </div>
        </div>

        <!-- Cart mode: quantity + add-to-cart. Product.requireOfferSelection
             (sold only in fixed lots, e.g. wholesale packs of 40/80 units)
             hides the free-quantity stepper entirely — the offer cards above
             are the only way to set quantity; see onSelectOffer/the
             auto-select watchEffect in products/[slug].vue. -->
        <div v-if="props.displayCart !== false" class="flex items-center gap-3 pt-2">
          <QuantityStepper v-if="!props.product?.requireOfferSelection" :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
          <Button :disabled="!props.inStock || (props.product?.requireOfferSelection && !props.selectedOfferId)" icon="i-lucide-shopping-cart" size="lg" @click="props.onAddToCart">
            {{ props.inStock ? 'Add to cart' : 'Out of stock' }}
          </Button>
        </div>
        <p v-if="props.displayCart !== false && props.added" class="text-sm text-success">Added to cart.</p>

        <!-- Lead form mode (displayCart=false): dynamic fields from admin config -->
        <div v-if="props.displayCart === false && props.inStock" class="mt-6 rounded-lg border border-default p-5 space-y-4">
          <div class="flex items-center gap-2">
            <Icon name="i-lucide-banknote" class="size-5 text-primary" />
            <h3 class="font-semibold text-highlighted">Order now — cash on delivery</h3>
          </div>
          <LeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
          <div class="flex items-center gap-3">
            <QuantityStepper v-if="!props.product?.requireOfferSelection" :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
            <Button block size="lg" :loading="props.leadPlacing" color="primary" @click="props.onSubmitLead">Place order</Button>
          </div>
          <p v-if="props.leadError" class="text-sm text-error">{{ props.leadError }}</p>
        </div>
      </div>
    </div>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="space-y-6">
      <h2 class="text-2xl font-semibold">Reviews</h2>
      <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-3xl font-bold">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-warning' : 'text-muted'" class="size-4" />
            </div>
          </div>
          <p class="text-sm text-muted">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
        </div>
        <div class="space-y-4 lg:col-span-2">
          <div v-for="review in props.reviewData.items" :key="review.id" class="border-b border-default pb-4">
            <div class="flex items-center gap-2">
              <div class="flex">
                <Icon v-for="i in 5" :key="i" name="i-lucide-star" :class="i <= review.rating ? 'text-warning' : 'text-muted'" class="size-3" />
              </div>
              <span class="text-sm font-medium">{{ review.customerName ?? 'Verified buyer' }}</span>
            </div>
            <p v-if="review.title" class="mt-2 font-medium">{{ review.title }}</p>
            <p v-if="review.body" class="mt-1 text-sm text-muted">{{ review.body }}</p>
          </div>
        </div>
      </div>
      <p v-else class="text-muted">No reviews yet — be the first after your order is delivered.</p>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="space-y-4">
      <h2 class="text-2xl font-semibold">You may also like</h2>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </main>
</template>
