<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Bloom PDP — light rounded-3xl gallery (no dark mat, unlike Atelier) +
// sticky glow-card order summary. Variants as rounded pill chips. Lead-form
// mode uses BloomLeadFormFields (cascading wilaya/commune). No @nuxt/ui
// anywhere.
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
  offerTotalCents?: number
  leadShippingPriceCents?: number
  onSelectImage: (i: number) => void
  onSelectVariantByKey: (key: string, val: string) => void
  onUpdateQuantity: (v: number) => void
  onAddToCart: () => void
  onSubmitLead?: () => void
  onSelectOffer?: (offer: ProductOffer) => void
}>()
</script>

<template>
  <div v-if="props.product" class="bg-[var(--color-bloom-blush)]">
    <!-- Breadcrumb -->
    <div class="border-b border-neutral-100 bg-[var(--color-bloom-blush)]">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-xs font-medium uppercase tracking-wide text-neutral-400 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <NuxtLink to="/catalog" class="hover:text-primary-600">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <span class="truncate text-neutral-600">{{ props.product.name }}</span>
      </nav>
    </div>

    <!-- Centered single column — no left/right split anywhere in Bloom's PDP.
         Swatches sit prominently right under the price, before the copy. -->
    <section class="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6 lg:px-8">
      <!-- AI landing page image — replaces the gallery+description when the
      merchant has generated and enabled one (see landing-page.ts). -->
      <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="mx-auto w-full max-w-sm rounded-3xl" />

      <!-- Gallery — centered, on top -->
      <div v-else class="space-y-4">
        <div class="mx-auto aspect-square max-w-sm overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-bloom-md)]">
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
        <div v-if="props.galleryImages.length > 1" class="flex justify-center gap-3">
          <button
            v-for="(img, i) in props.galleryImages"
            :key="i"
            class="size-16 overflow-hidden rounded-2xl bg-white ring-2 transition-all"
            :class="i === props.activeImageIndex ? 'ring-primary-500' : 'ring-transparent hover:ring-primary-200'"
            @click="props.onSelectImage(i)"
          >
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="64" height="64" loading="lazy" />
          </button>
        </div>
      </div>

      <div class="mt-8">
        <p v-if="props.product.category" class="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">{{ props.product.category }}</p>
        <h1 class="font-display mt-1 text-4xl text-[var(--color-bloom-ink)] sm:text-5xl">{{ props.product.name }}</h1>
      </div>

      <!-- Star rating -->
      <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="mt-3 flex items-center justify-center gap-2 text-sm">
        <div class="flex">
          <Icon
            v-for="i in 5"
            :key="i"
            name="i-lucide-star"
            class="size-4"
            :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-500' : 'text-neutral-200'"
          />
        </div>
        <span class="font-medium text-[var(--color-bloom-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
        <span class="text-neutral-400">({{ props.reviewData.summary.count }} reviews)</span>
      </div>

      <!-- Price + stock badges -->
      <div class="mt-4 flex items-center justify-center gap-3">
        <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-semibold text-primary-600" />
        <BloomBadge v-if="!props.inStock" color="error">Out of stock</BloomBadge>
        <BloomBadge v-else-if="props.effectiveStock <= props.product.lowStockThreshold" color="primary">Only {{ props.effectiveStock }} left</BloomBadge>
      </div>

      <!-- Variant swatches — prominent, right under the price -->
      <div v-for="(values, key) in props.variantOptions" :key="key" class="mt-6 space-y-3">
        <p class="text-sm font-medium capitalize text-[var(--color-bloom-ink)]">{{ key }}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="val in values"
            :key="val"
            class="rounded-full border px-4 py-1.5 text-sm font-medium transition-all"
            :class="props.selectedVariant?.attributes[key] === val
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-neutral-200 text-neutral-600 hover:border-primary-300'"
            @click="props.onSelectVariantByKey(key, val)"
          >
            {{ val }}
          </button>
        </div>
      </div>

      <div v-if="props.product.description && !props.landingPageImageUrl" class="product-description-html mx-auto mt-6 max-w-md leading-relaxed text-neutral-600" v-html="sanitizeDescriptionHtml(props.product.description)" />

      <!-- Offers -->
      <div v-if="props.offers?.length" class="mx-auto mt-6 max-w-sm space-y-2 text-left">
        <button
          v-for="offer in props.offers"
          :key="offer.id"
          type="button"
          class="flex w-full items-center justify-between rounded-full border px-4 py-2 text-left text-sm font-medium transition-all"
          :class="props.selectedOfferId === offer.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:border-primary-300'"
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

      <!-- Cart mode: COD order summary card -->
      <div v-if="props.displayCart !== false" class="glow-card mx-auto mt-8 max-w-sm p-6 text-left">
        <div class="mb-4 flex items-center gap-2">
          <Icon name="i-lucide-truck" class="size-5 text-primary-600" />
          <h2 class="font-display text-xl text-[var(--color-bloom-ink)]">Order summary</h2>
        </div>
        <div class="mb-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Quantity</p>
          <BloomQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
        </div>
        <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
          <div class="flex items-center justify-between"><span class="text-neutral-500">Subtotal</span><PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="font-medium" /></div>
          <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
        </div>
        <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
          <span class="font-medium text-[var(--color-bloom-ink)]">Total</span>
          <PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="text-xl font-semibold text-primary-600" />
        </div>
        <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
        <BloomButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="lg" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to bag' : 'Out of stock' }}</BloomButton>
        <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-600"><Icon name="i-lucide-check-circle" class="size-4" /> Added to bag.</p>
      </div>

      <!-- Lead form mode -->
      <div v-if="props.displayCart === false && props.inStock" class="glow-card mx-auto mt-8 max-w-sm space-y-4 p-6 text-left">
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
          <h2 class="font-display text-xl text-[var(--color-bloom-ink)]">Order now — cash on delivery</h2>
        </div>
        <BloomLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
        <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
          <span class="font-medium text-[var(--color-bloom-ink)]">Total</span>
          <PriceDisplay :amount-cents="(props.offerTotalCents ?? props.effectivePriceCents * props.quantity) + (props.leadShippingPriceCents ?? 0)" class="text-xl font-semibold text-primary-600" />
        </div>
        <div class="flex items-center gap-3">
          <BloomQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
          <BloomButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</BloomButton>
        </div>
        <p v-if="props.leadError" class="text-sm font-medium text-primary-700">{{ props.leadError }}</p>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="glow-card p-8">
        <h2 class="font-display mb-6 text-3xl text-[var(--color-bloom-ink)]">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-semibold text-[var(--color-bloom-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-5"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-500' : 'text-neutral-200'"
              />
            </div>
            <p class="text-sm text-neutral-500">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
          </div>
          <div class="space-y-5 lg:col-span-2">
            <div v-for="review in props.reviewData.items" :key="review.id" class="border-b border-neutral-100 pb-5 last:border-0">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <Icon
                    v-for="i in 5"
                    :key="i"
                    name="i-lucide-star"
                    class="size-3.5"
                    :class="i <= review.rating ? 'text-primary-500' : 'text-neutral-200'"
                  />
                </div>
                <span class="text-sm font-medium text-[var(--color-bloom-ink)]">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-medium text-[var(--color-bloom-ink)]">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-neutral-600">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-neutral-500">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-3xl text-[var(--color-bloom-ink)]">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
