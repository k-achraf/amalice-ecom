<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField, VariantSwatches } from '@amalice/shared'

// Quartz PDP — a lean, mobile-first single-product COD order page, deliberately
// modeled on a proven high-converting Shopify order-page layout: gallery →
// title/price → variant pills → ONE order card holding the lead/cart form,
// an itemized price table (product/delivery/total — see .price-table in
// quartz.css), and the buy button → a short trust row. Unlike Impulse (a
// long persuasion-sequence funnel with countdowns/tickers/scarcity), this
// stays a single short scroll on purpose — do not pad it out with Impulse's
// mechanics when extending this file.
//
// GENERIC BY DESIGN: every label/heading here is category-neutral ("المنتج",
// "صور المنتج", "لماذا تختارين هذا المنتج" → kept plain) so the same
// template reads correctly whether the active product is a watch, a bag, a
// piece of furniture, or anything else — this template can be assigned to
// any store, not just one product category. Don't add copy that assumes a
// specific product type.
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
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

function offerSavingsCents(offer: ProductOffer) {
  if (offer.type === 'FixedBundlePrice') {
    return Math.max(0, props.effectivePriceCents * offer.requiredQuantity - (offer.bundlePriceCents ?? 0))
  }
  if (offer.type === 'BuyXGetYFree') return props.effectivePriceCents * offer.freeQuantity
  return 0
}
const bestOfferId = computed(() => {
  const offers = props.offers ?? []
  if (!offers.length) return null
  let best: ProductOffer | null = null
  for (const offer of offers) {
    if (!best || offerSavingsCents(offer) > offerSavingsCents(best)) best = offer
  }
  return best && offerSavingsCents(best) > 0 ? best.id : null
})

// The base line total before delivery — offer price if one's selected,
// otherwise unit price × quantity. Same math as every other template.
const baseTotalCents = computed(() => props.offerTotalCents ?? props.effectivePriceCents * props.quantity)
// Delivery cost currently selected in the lead form — falls back to reading
// it straight out of leadFormData in case a caller ever omits the prop
// (mirrors how the AI landing-page funnel's own lead card has to read it).
const shippingCents = computed(() => props.leadShippingPriceCents ?? Number(props.leadFormData?.shippingPriceCents || 0))
const grandTotalCents = computed(() => baseTotalCents.value + (props.displayCart === false ? shippingCents.value : 0))

function scrollToOrderForm() {
  document.getElementById('quartz-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
function selectOfferAndScroll(offer: ProductOffer) {
  props.onSelectOffer?.(offer)
  scrollToOrderForm()
}
function onStickyCta() {
  if (props.displayCart === false) {
    scrollToOrderForm()
  } else {
    props.onAddToCart()
  }
}
</script>

<template>
  <div v-if="props.product" class="pb-24">
    <div class="mx-auto max-w-xl space-y-5 px-4 pt-5 sm:px-6">
      <!-- 1. Gallery — main image + thumbnail strip when more than one shot
           exists. Color/variant pills live right under it, not inside the
           order form, so picking a color reads as part of looking at the
           product rather than filling out a form. -->
      <div class="quartz-card aspect-square overflow-hidden">
        <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="size-full object-cover" fetchpriority="high">
        <NuxtImg
          v-else-if="props.galleryImages.length"
          :src="props.galleryImages[props.activeImageIndex]?.url"
          :alt="props.galleryImages[props.activeImageIndex]?.alt"
          class="size-full object-cover"
          width="700"
          height="700"
          loading="eager"
          format="webp"
          preload
          fetchpriority="high"
        />
      </div>

      <div v-if="!props.landingPageImageUrl && props.galleryImages.length > 1" class="flex gap-2 overflow-x-auto pb-1">
        <button
          v-for="(img, i) in props.galleryImages"
          :key="i"
          type="button"
          class="size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all"
          :class="i === props.activeImageIndex ? '!border-primary-500' : '!border-neutral-200'"
          @click="props.onSelectImage(i)"
        >
          <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="120" height="120" loading="lazy" format="webp" />
        </button>
      </div>

      <!-- 2. Title, rating (if any real reviews exist), price. -->
      <div class="space-y-1.5">
        <QuartzBadge v-if="props.product.category" color="neutral">{{ props.product.category }}</QuartzBadge>
        <h1 class="font-display text-2xl font-medium leading-snug text-neutral-900">{{ props.product.name }}</h1>
        <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
          <div class="flex">
            <Icon
              v-for="i in 5"
              :key="i"
              name="i-lucide-star"
              class="size-3.5"
              :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-500' : 'text-neutral-200'"
            />
          </div>
          <span class="font-semibold text-neutral-900">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
          <span class="text-neutral-500">({{ props.reviewData.summary.count }})</span>
        </div>
        <div class="flex items-center gap-2 pt-0.5">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="font-display text-2xl font-semibold text-neutral-900" />
          <QuartzBadge v-if="!props.inStock" color="red" variant="solid">نفدت الكمية</QuartzBadge>
        </div>
      </div>

      <!-- 3. Variant pills — outside the order card, styled as product
           options rather than form inputs. -->
      <div v-if="Object.keys(props.variantOptions).length" class="space-y-3">
        <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">{{ key }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="val in values"
              :key="val"
              type="button"
              class="rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-all"
              :class="props.selectedVariant?.attributes[key] === val
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-neutral-200 text-neutral-700 hover:border-primary-300'"
              @click="props.onSelectVariantByKey(key, val)"
            >
              <span v-if="swatchColor(key, val)" class="me-1.5 inline-block size-3 rounded-full border border-black/15 align-middle" :style="{ backgroundColor: swatchColor(key, val) }" />{{ val }}
            </button>
          </div>
        </div>
      </div>

      <!-- 4. THE order card — offers, cart/lead fields, itemized price
           table, buy button — everything the shopper needs in one place. -->
      <div id="quartz-order-form" class="quartz-card scroll-mt-24 space-y-4 p-5">
        <!-- Offer cards -->
        <div v-if="props.offers?.length" class="space-y-2">
          <button
            v-for="offer in props.offers"
            :key="offer.id"
            type="button"
            class="relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition-all"
            :class="props.selectedOfferId === offer.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'"
            @click="props.onSelectOffer?.(offer)"
          >
            <span v-if="offer.id === bestOfferId" class="absolute -top-2.5 start-3">
              <QuartzBadge color="primary" variant="solid">أفضل قيمة</QuartzBadge>
            </span>
            <span class="text-sm font-semibold text-neutral-900">
              <template v-if="offer.type === 'FixedBundlePrice'">اشترِ {{ offer.requiredQuantity }} مقابل <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
              <template v-else-if="offer.type === 'BuyXGetYFree'">اشترِ {{ offer.requiredQuantity }}، واحصل على {{ offer.freeQuantity }} مجاناً</template>
              <template v-else>اشترِ {{ offer.requiredQuantity }} — شحن مجاني</template>
            </span>
            <span v-if="offerSavingsCents(offer) > 0" class="text-xs font-bold text-[var(--color-quartz-green)]">
              وفّر <PriceDisplay :amount-cents="offerSavingsCents(offer)" />
            </span>
          </button>
        </div>

        <!-- Cart mode -->
        <template v-if="props.displayCart !== false">
          <div v-if="!props.product?.requireOfferSelection" class="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-2.5">
            <span class="text-sm font-semibold text-neutral-700">الكمية</span>
            <div class="flex items-center gap-3">
              <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600 disabled:opacity-40" :disabled="props.quantity <= 1" @click="props.onUpdateQuantity(props.quantity - 1)">−</button>
              <span class="min-w-4 text-center text-sm font-bold text-neutral-900">{{ props.quantity }}</span>
              <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600" :disabled="props.quantity >= props.effectiveStock" @click="props.onUpdateQuantity(props.quantity + 1)">+</button>
            </div>
          </div>

          <div class="price-table">
            <div class="price-row"><span>سعر المنتج</span><PriceDisplay :amount-cents="props.effectivePriceCents" /></div>
            <div class="price-row total"><span>المجموع</span><PriceDisplay :amount-cents="baseTotalCents" /></div>
          </div>

          <QuartzButton
            :disabled="!props.inStock || (props.product?.requireOfferSelection && !props.selectedOfferId)"
            size="xl"
            block
            shine
            icon="i-lucide-shopping-bag"
            @click="props.onAddToCart"
          >
            {{ props.inStock ? 'أضف إلى السلة' : 'غير متوفر' }}
          </QuartzButton>
          <p v-if="props.added" class="text-center text-sm font-semibold text-[var(--color-quartz-green)]">
            <Icon name="i-lucide-check-circle" class="me-1 inline size-4 align-[-2px]" />
            تمت الإضافة — انتقل إلى سلتك لإتمام الطلب.
          </p>
        </template>

        <!-- Lead form mode — full recreation of the reference order page:
             name/phone/wilaya/commune + delivery method, then an itemized
             product/delivery/total price table, then the buy button. -->
        <template v-if="props.displayCart === false && props.inStock">
          <QuartzLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />

          <div v-if="!props.product?.requireOfferSelection" class="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-2.5">
            <span class="text-sm font-semibold text-neutral-700">الكمية</span>
            <div class="flex items-center gap-3">
              <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600 disabled:opacity-40" :disabled="props.quantity <= 1" @click="props.onUpdateQuantity(props.quantity - 1)">−</button>
              <span class="min-w-4 text-center text-sm font-bold text-neutral-900">{{ props.quantity }}</span>
              <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600" @click="props.onUpdateQuantity(props.quantity + 1)">+</button>
            </div>
          </div>

          <div class="price-table">
            <div class="price-row"><span>سعر المنتج</span><PriceDisplay :amount-cents="baseTotalCents" /></div>
            <div class="price-row">
              <span>سعر التوصيل</span>
              <PriceDisplay v-if="props.leadFormData?.shippingType" :amount-cents="shippingCents" />
              <span v-else class="text-neutral-400">—</span>
            </div>
            <div class="price-row total"><span>المجموع</span><PriceDisplay :amount-cents="grandTotalCents" /></div>
          </div>

          <QuartzButton size="xl" block shine :loading="props.leadPlacing" trailing-icon="i-lucide-arrow-left" @click="props.onSubmitLead">
            اشتري الآن — <PriceDisplay :amount-cents="grandTotalCents" />
          </QuartzButton>
          <p v-if="props.leadError" class="text-center text-sm font-semibold text-[var(--color-quartz-red)]">{{ props.leadError }}</p>
        </template>

        <p class="flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-400">
          <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-quartz-green)]" />
          بدون دفع مسبق. نتصل بك للتأكيد قبل شحن أي شيء.
        </p>
      </div>

      <!-- 5. Description — the admin's existing rich-text description,
           only shown when filled in. -->
      <div v-if="props.product.description && !props.landingPageImageUrl" class="quartz-card space-y-2 p-5">
        <h2 class="font-display text-lg font-medium text-neutral-900">تفاصيل المنتج</h2>
        <div class="product-description-html text-sm leading-relaxed text-neutral-700" v-html="sanitizeDescriptionHtml(props.product.description)" />
      </div>

      <!-- 6. Trust row. -->
      <QuartzTrustRow />

      <!-- 7. Social proof — real reviews only. -->
      <div v-if="props.reviewData && props.reviewData.items.length" class="space-y-3">
        <h2 class="text-center font-display text-lg font-medium text-neutral-900">آراء المشترين</h2>
        <div v-for="review in props.reviewData.items" :key="review.id" class="quartz-card space-y-2 p-4">
          <div class="flex items-center justify-between">
            <div class="flex">
              <Icon v-for="i in 5" :key="i" name="i-lucide-star" class="size-3.5" :class="i <= review.rating ? 'text-primary-500' : 'text-neutral-200'" />
            </div>
            <QuartzBadge color="green">
              <Icon name="i-lucide-badge-check" class="size-3" />
              مشترٍ موثّق
            </QuartzBadge>
          </div>
          <p v-if="review.title" class="text-sm font-semibold text-neutral-900">{{ review.title }}</p>
          <p v-if="review.body" class="text-sm leading-relaxed text-neutral-600">"{{ review.body }}"</p>
          <p class="text-xs text-neutral-400">— {{ review.customerName ?? 'مشترٍ موثّق' }}</p>
        </div>
      </div>

      <!-- 8. Offer recap for stores that configured offers, shown as a
           lightweight cross-sell if not already handled above. -->
      <div v-if="props.offers?.length" class="space-y-3">
        <h2 class="text-center font-display text-lg font-medium text-neutral-900">وفّر أكثر</h2>
        <button
          v-for="offer in props.offers"
          :key="offer.id"
          type="button"
          class="quartz-card relative flex w-full items-center justify-between gap-3 border-2 !border-primary-200 p-4 text-start"
          @click="selectOfferAndScroll(offer)"
        >
          <span class="text-sm font-semibold text-neutral-900">
            <template v-if="offer.type === 'FixedBundlePrice'">اشترِ {{ offer.requiredQuantity }} مقابل <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
            <template v-else-if="offer.type === 'BuyXGetYFree'">اشترِ {{ offer.requiredQuantity }}، واحصل على {{ offer.freeQuantity }} مجاناً</template>
            <template v-else>اشترِ {{ offer.requiredQuantity }} — شحن مجاني</template>
          </span>
          <span v-if="offerSavingsCents(offer) > 0" class="shrink-0 text-sm font-bold text-[var(--color-quartz-green)]">
            وفّر <PriceDisplay :amount-cents="offerSavingsCents(offer)" />
          </span>
        </button>
      </div>

      <!-- 9. Related — light cross-sell. -->
      <div v-if="props.product.related?.length" class="space-y-3">
        <h2 class="text-center font-display text-lg font-medium text-neutral-900">قد يعجبك أيضاً</h2>
        <div class="grid grid-cols-2 gap-3">
          <TemplateSection v-for="p in props.product.related.slice(0, 2)" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
      </div>

      <!-- 10. FAQ — admin-authored, only shown when filled in. -->
      <div v-if="props.product.faqs?.length" class="space-y-3">
        <h2 class="text-center font-display text-lg font-medium text-neutral-900">الأسئلة الشائعة</h2>
        <details v-for="(faq, i) in props.product.faqs" :key="i" class="group quartz-card p-4">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-900">
            {{ faq.question }}
            <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
          </summary>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">{{ faq.answer }}</p>
        </details>
      </div>

      <!-- 11. Specifications — admin-authored, only shown when filled in. -->
      <details v-if="props.product.specifications?.length" class="group quartz-card p-4">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-900">
          المواصفات
          <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
        </summary>
        <dl class="mt-3 divide-y divide-neutral-100 text-sm">
          <div v-for="(spec, i) in props.product.specifications" :key="i" class="flex justify-between gap-3 py-2">
            <dt class="text-neutral-500">{{ spec.label }}</dt>
            <dd class="font-semibold text-neutral-900">{{ spec.value }}</dd>
          </div>
        </dl>
      </details>
    </div>

    <!-- 12. Sticky bottom order bar — keeps the buy button on screen for the
         whole scroll (mobile-first: this is the primary CTA path on a phone). -->
    <div v-if="props.inStock" class="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 py-3 shadow-[0_-8px_24px_-8px_rgba(36,28,20,0.16)] backdrop-blur-sm">
      <div class="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <p class="line-clamp-1 text-xs font-semibold text-neutral-900">{{ props.product.name }}</p>
          <PriceDisplay :amount-cents="grandTotalCents" class="font-display text-base font-semibold text-primary-700" />
        </div>
        <QuartzButton size="md" shine trailing-icon="i-lucide-arrow-left" @click="onStickyCta">
          {{ props.displayCart === false ? 'اشتري الآن' : 'أضف إلى السلة' }}
        </QuartzButton>
      </div>
    </div>
  </div>
</template>
