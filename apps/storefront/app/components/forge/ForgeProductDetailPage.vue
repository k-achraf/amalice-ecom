<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField, VariantSwatches } from '@amalice/shared'

// Forge PDP — bordered gallery + bordered sticky order-summary card, boxed
// SKU label, variants as bordered swatch chips. Lead-form mode uses
// ForgeLeadFormFields (cascading wilaya/commune). No @nuxt/ui anywhere.
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
  offerTotalCents?: number
  leadShippingPriceCents?: number
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

const skuLabel = computed(() => props.product ? `SKU-${props.product.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : '')
</script>

<template>
  <div v-if="props.product" class="bg-white">
    <!-- Breadcrumb band -->
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-white">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm font-bold uppercase text-[var(--color-forge-ink)]/50 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <NuxtLink to="/catalog" class="hover:underline">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <span class="truncate text-[var(--color-forge-ink)]">{{ props.product.name }}</span>
      </nav>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- AI landing page image — replaces the gallery+description when the
      merchant has generated and enabled one (see landing-page.ts). -->
      <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="mb-10 w-full border-[3px] border-[var(--color-forge-ink)]" />

      <div class="grid grid-cols-1 gap-10" :class="props.landingPageImageUrl ? '' : 'lg:grid-cols-2'">
        <!-- Gallery -->
        <div v-if="!props.landingPageImageUrl" class="space-y-4">
          <div class="aspect-square overflow-hidden border-[3px] border-[var(--color-forge-ink)] bg-white">
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
          <div v-if="props.galleryImages.length > 1" class="flex gap-3">
            <button
              v-for="(img, i) in props.galleryImages"
              :key="i"
              class="size-20 overflow-hidden border-[3px] transition-all"
              :class="i === props.activeImageIndex ? 'border-[var(--color-forge-ink)]' : 'border-[var(--color-forge-ink)]/20 hover:border-[var(--color-forge-ink)]/60'"
              @click="props.onSelectImage(i)"
            >
              <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Detail + order summary -->
        <div class="space-y-6">
          <div>
            <p v-if="props.product.category" class="text-xs font-bold uppercase tracking-wide text-primary-700">{{ props.product.category }}</p>
            <h1 class="font-display mt-1 text-3xl uppercase sm:text-4xl">{{ props.product.name }}</h1>
          </div>

          <!-- Star rating -->
          <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-4"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-600' : 'text-[var(--color-forge-ink)]/20'"
              />
            </div>
            <span class="font-bold text-[var(--color-forge-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <span class="text-[var(--color-forge-ink)]/40">({{ props.reviewData.summary.count }} reviews)</span>
          </div>

          <!-- Price + stock badges -->
          <div class="flex items-center gap-3">
            <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-bold text-[var(--color-forge-ink)]" />
            <ForgeBadge v-if="!props.inStock" color="error">Out of stock</ForgeBadge>
            <ForgeBadge v-else-if="props.effectiveStock <= props.product.lowStockThreshold" color="warning">Only {{ props.effectiveStock }} left</ForgeBadge>
          </div>

          <div v-if="props.product.description && !props.landingPageImageUrl" class="product-description-html leading-relaxed text-[var(--color-forge-ink)]/60" v-html="sanitizeDescriptionHtml(props.product.description)" />

          <!-- Offers -->
          <div v-if="props.offers?.length" class="space-y-2">
            <button
              v-for="offer in props.offers"
              :key="offer.id"
              type="button"
              class="flex w-full items-center justify-between border-[3px] px-4 py-2 text-left text-sm font-bold transition-all"
              :class="props.selectedOfferId === offer.id ? 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)]' : 'border-[var(--color-forge-ink)]/20 text-[var(--color-forge-ink)]/70 hover:border-[var(--color-forge-ink)]'"
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

          <!-- Spec sheet — the SKU, category, stock and delivery terms laid
               out as a monospace data block, echoing the home hero's spec
               panel instead of a small inline tag. -->
          <div class="border-[3px] border-[var(--color-forge-ink)] bg-neutral-50">
            <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] px-4 py-2">
              <span class="font-display text-xs uppercase tracking-wide text-white">Spec sheet</span>
            </div>
            <dl class="divide-y-2 divide-[var(--color-forge-ink)]/10 text-sm">
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-xs font-bold uppercase text-[var(--color-forge-ink)]/50">SKU</dt>
                <dd class="font-mono font-bold text-[var(--color-forge-ink)]">{{ skuLabel }}</dd>
              </div>
              <div v-if="props.product.category" class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-xs font-bold uppercase text-[var(--color-forge-ink)]/50">Category</dt>
                <dd class="font-mono font-bold text-[var(--color-forge-ink)]">{{ props.product.category }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-xs font-bold uppercase text-[var(--color-forge-ink)]/50">Stock</dt>
                <dd class="font-mono font-bold" :class="props.inStock ? 'text-primary-700' : 'text-red-700'">{{ props.inStock ? `${props.effectiveStock} units` : 'Out of stock' }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-xs font-bold uppercase text-[var(--color-forge-ink)]/50">Delivery</dt>
                <dd class="font-mono font-bold text-[var(--color-forge-ink)]">Cash on arrival</dd>
              </div>
            </dl>
          </div>

          <!-- Variants as bordered chips -->
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-3">
            <p class="text-sm font-bold uppercase text-[var(--color-forge-ink)]">{{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="border-[3px] px-4 py-1.5 text-sm font-bold transition-all"
                :class="props.selectedVariant?.attributes[key] === val
                  ? 'border-[var(--color-forge-ink)] bg-primary-500 text-[var(--color-forge-ink)]'
                  : 'border-[var(--color-forge-ink)]/20 text-[var(--color-forge-ink)]/70 hover:border-[var(--color-forge-ink)]'"
                @click="props.onSelectVariantByKey(key, val)"
              >
                <span v-if="swatchColor(key, val)" class="me-1.5 inline-block size-3 rounded-full border border-black/15 align-middle" :style="{ backgroundColor: swatchColor(key, val) }" />{{ val }}
              </button>
            </div>
          </div>

          <!-- Cart mode: COD order summary card -->
          <div v-if="props.displayCart !== false" class="border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
            <div class="mb-4 flex items-center gap-2">
              <Icon name="i-lucide-truck" class="size-5 text-primary-700" />
              <h2 class="font-display text-lg uppercase">Order summary</h2>
            </div>
            <div class="mb-4">
              <p class="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">Quantity</p>
              <ForgeQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
            </div>
            <div class="space-y-2 border-t-[3px] border-[var(--color-forge-ink)]/10 pt-4 text-sm">
              <div class="flex items-center justify-between"><span class="text-[var(--color-forge-ink)]/50">Subtotal</span><PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="font-bold" /></div>
              <div class="flex items-center justify-between"><span class="text-[var(--color-forge-ink)]/50">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
            </div>
            <div class="mt-4 flex items-center justify-between border-t-[3px] border-[var(--color-forge-ink)] pt-4">
              <span class="font-bold uppercase">Total</span>
              <PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="text-xl font-bold" />
            </div>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-forge-ink)]/40"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
            <ForgeButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="lg" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to cart' : 'Out of stock' }}</ForgeButton>
            <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-700"><Icon name="i-lucide-check-circle" class="size-4" /> Added to cart.</p>
          </div>

          <!-- Lead form mode -->
          <div v-if="props.displayCart === false && props.inStock" class="space-y-4 border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-banknote" class="size-5 text-primary-700" />
              <h2 class="font-display text-lg uppercase">Order now — cash on delivery</h2>
            </div>
            <ForgeLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
            <div class="flex items-center justify-between border-t-[3px] border-[var(--color-forge-ink)] pt-4">
              <span class="font-bold uppercase">Total</span>
              <PriceDisplay :amount-cents="(props.offerTotalCents ?? props.effectivePriceCents * props.quantity) + (props.leadShippingPriceCents ?? 0)" class="text-xl font-bold" />
            </div>
            <div class="flex items-center gap-3">
              <ForgeQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
              <ForgeButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</ForgeButton>
            </div>
            <p v-if="props.leadError" class="text-sm font-bold text-red-700">{{ props.leadError }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="border-[3px] border-[var(--color-forge-ink)] bg-white p-8">
        <h2 class="font-display mb-6 text-2xl uppercase">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-bold text-[var(--color-forge-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-5"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-600' : 'text-[var(--color-forge-ink)]/20'"
              />
            </div>
            <p class="text-sm text-[var(--color-forge-ink)]/50">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
          </div>
          <div class="space-y-5 lg:col-span-2">
            <div v-for="review in props.reviewData.items" :key="review.id" class="border-b-[3px] border-[var(--color-forge-ink)]/10 pb-5 last:border-0">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <Icon
                    v-for="i in 5"
                    :key="i"
                    name="i-lucide-star"
                    class="size-3.5"
                    :class="i <= review.rating ? 'text-primary-600' : 'text-[var(--color-forge-ink)]/20'"
                  />
                </div>
                <span class="text-sm font-bold text-[var(--color-forge-ink)]">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-bold text-[var(--color-forge-ink)]">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-[var(--color-forge-ink)]/60">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-[var(--color-forge-ink)]/50">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-2xl uppercase">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
