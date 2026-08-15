<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField, VariantSwatches } from '@amalice/shared'

// Impulse PDP — the funnel's money page, restructured for mobile
// COD-ad-traffic conversion (Facebook/Instagram → this page). Ordered by the
// classic direct-response sequence, each block earning the scroll to the
// next: top trust strip → hero (image, name, rating, price, COD, primary
// CTA) → key benefits → lifestyle gallery → why you'll love it → social
// proof → offer recap → shipping & trust → THE order form (offer cards,
// variants, lead/cart fields, and the pulsing CTA all together in one card,
// completely unchanged from before — only its position on the page moved)
// → how-it-works → related → FAQ → specifications → store trust. A sticky
// bottom order bar keeps the CTA on screen for the entire scroll. No
// @nuxt/ui.
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


// Per-offer savings vs buying the same units at the regular price — real
// math from the offers feature, no invented compare-at prices. The largest
// saver gets the "BEST VALUE" flag. Used both by the order form's own offer
// cards and by the read-only offer recap section further up the page.
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
const bestOffer = computed(() => props.offers?.find((o) => o.id === bestOfferId.value) ?? null)

// The order form itself is never touched — every CTA on the page above it
// (hero, offer recap, sticky bar in lead mode) just scrolls the same
// untouched #impulse-order-form card into view.
function scrollToOrderForm() {
  document.getElementById('impulse-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Offer recap CTA — pre-selects the offer via the exact same callback prop
// the order form's own offer card uses, then scrolls down to it. Doesn't
// touch the form's markup or logic, just calls the same public prop from a
// different spot on the page.
function selectOfferAndScroll(offer: ProductOffer) {
  props.onSelectOffer?.(offer)
  scrollToOrderForm()
}

// Sticky bar CTA: lead mode scrolls to the order form; cart mode adds to
// cart directly (unchanged from before — this is the established add-to-cart
// behavior for cart-enabled stores, not something this restructure changes).
function onStickyCta() {
  if (props.displayCart === false) {
    scrollToOrderForm()
  } else {
    props.onAddToCart()
  }
}
</script>

<template>
  <div v-if="props.product" class="bg-neutral-50 pb-24">
    <!-- 1. Top trust bar — the three headline COD reassurances, visible
         before anything else loads in. -->
    <div class="border-b border-neutral-200 bg-white py-2">
      <div class="mx-auto flex max-w-2xl items-center justify-center gap-4 px-4 text-[11px] font-bold text-neutral-700 sm:gap-6 sm:px-6">
        <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5 text-[var(--color-impulse-green)]" />الدفع عند الاستلام</span>
        <span class="flex items-center gap-1"><Icon name="i-lucide-truck" class="size-3.5 text-[var(--color-impulse-green)]" />توصيل لكل الولايات الـ58</span>
        <span class="flex items-center gap-1"><Icon name="i-lucide-phone-call" class="size-3.5 text-[var(--color-impulse-green)]" />تأكيد الطلب هاتفياً</span>
      </div>
    </div>

    <div class="mx-auto max-w-2xl space-y-6 px-4 pt-6 sm:px-6">
      <!-- 2. Hero — social-proof header, main image, price, COD note, and a
           primary CTA straight into the (untouched) order form below. -->
      <div class="space-y-2 text-center">
        <ImpulseBadge v-if="props.product.category" color="neutral" variant="subtle">{{ props.product.category }}</ImpulseBadge>
        <h1 class="font-display text-3xl font-black uppercase leading-tight text-neutral-900 sm:text-4xl">{{ props.product.name }}</h1>
        <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center justify-center gap-2 text-sm">
          <div class="flex">
            <Icon
              v-for="i in 5"
              :key="i"
              name="i-lucide-star"
              class="size-4"
              :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-[var(--color-impulse-yellow)]' : 'text-neutral-200'"
            />
          </div>
          <span class="font-bold text-neutral-900">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
          <span class="text-neutral-500">— بتقييم {{ props.reviewData.summary.count }} مشترٍ موثّق</span>
        </div>
      </div>

      <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="w-full rounded-2xl" fetchpriority="high" />
      <div v-else class="funnel-card aspect-square overflow-hidden">
        <NuxtImg
          v-if="props.galleryImages.length"
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

      <div class="funnel-card space-y-3 p-6 text-center">
        <div class="flex items-center justify-center gap-3">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="font-display text-4xl font-black text-neutral-900" />
          <ImpulseBadge v-if="!props.inStock" color="red" variant="solid">نفدت الكمية</ImpulseBadge>
        </div>
        <p class="text-xs font-semibold text-neutral-500">
          <Icon name="i-lucide-banknote" class="me-1 inline size-3.5 align-[-2px] text-[var(--color-impulse-green)]" />
          الدفع عند الاستلام — لا تدفع شيئاً حتى يصل الطلب إلى يديك
        </p>

        <!-- Scarcity bar — real stock, striped animated fill. -->
        <ImpulseScarcity :stock="props.effectiveStock" :threshold="props.product.lowStockThreshold" class="pt-2" />
      </div>

      <ImpulseButton v-if="props.inStock" size="xl" block pulse trailing-icon="i-lucide-arrow-left" @click="scrollToOrderForm">
        اطلب الآن — ادفع عند الاستلام
      </ImpulseButton>

      <!-- 3. Key benefits — customer-facing bullets, admin-authored. Only
           shown when the merchant has actually filled these in (never
           fabricated). -->
      <div v-if="props.product.keyBenefits?.length" class="funnel-card space-y-3 p-6">
        <h2 class="text-center font-display text-lg font-black uppercase text-neutral-900">لماذا تختار هذا المنتج</h2>
        <ul class="space-y-2.5">
          <li v-for="benefit in props.product.keyBenefits.slice(0, 4)" :key="benefit" class="flex items-start gap-2.5 text-sm text-neutral-700">
            <Icon name="i-lucide-check-circle" class="mt-0.5 size-4 shrink-0 text-[var(--color-impulse-green)]" />
            <span>{{ benefit }}</span>
          </li>
        </ul>
      </div>

      <!-- 4. Lifestyle / product gallery — every uploaded shot (on-body,
           close-ups, colors, angles — whatever the merchant provided),
           reused as visual storytelling rather than a plain thumbnail strip. -->
      <div v-if="!props.landingPageImageUrl && props.galleryImages.length > 1" class="space-y-3">
        <h2 class="text-center font-display text-lg font-black uppercase text-neutral-900">صور المنتج</h2>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="(img, i) in props.galleryImages"
            :key="i"
            type="button"
            class="funnel-card aspect-square overflow-hidden border-2 transition-all"
            :class="i === props.activeImageIndex ? '!border-primary-500' : '!border-transparent'"
            @click="props.onSelectImage(i)"
          >
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="350" height="350" loading="lazy" format="webp" />
          </button>
        </div>
      </div>

      <!-- 5. Why you'll love it — the admin's existing rich-text
           description, unchanged, just repositioned into its own funnel
           moment instead of sitting mid-page. -->
      <div v-if="props.product.description && !props.landingPageImageUrl" class="funnel-card space-y-3 p-6">
        <h2 class="font-display text-lg font-black uppercase text-neutral-900">لماذا ستحبه</h2>
        <div class="product-description-html text-sm leading-relaxed text-neutral-700" v-html="sanitizeDescriptionHtml(props.product.description)" />
      </div>

      <!-- 6. Social proof — reviews as proof cards, real ratings only. -->
      <div v-if="props.reviewData && props.reviewData.items.length" class="space-y-3">
        <h2 class="text-center font-display text-2xl font-black uppercase text-neutral-900">مشترون حقيقيون. <span class="marker">تقييمات حقيقية.</span></h2>
        <div v-for="review in props.reviewData.items" :key="review.id" class="funnel-card space-y-2 p-5">
          <div class="flex items-center justify-between">
            <div class="flex">
              <Icon v-for="i in 5" :key="i" name="i-lucide-star" class="size-4" :class="i <= review.rating ? 'text-[var(--color-impulse-yellow)]' : 'text-neutral-200'" />
            </div>
            <ImpulseBadge color="green" variant="subtle">
              <Icon name="i-lucide-badge-check" class="size-3" />
              مشترٍ موثّق
            </ImpulseBadge>
          </div>
          <p v-if="review.title" class="font-bold text-neutral-900">{{ review.title }}</p>
          <p v-if="review.body" class="text-sm leading-relaxed text-neutral-600">"{{ review.body }}"</p>
          <p class="text-xs font-semibold text-neutral-400">— {{ review.customerName ?? 'مشترٍ موثّق' }}</p>
        </div>
      </div>

      <!-- 7. Offer recap — read-only preview of the real offers (no
           duplicate selection UI; clicking pre-selects via the same prop the
           order form itself uses, then scrolls to it). Regular price is
           always shown for comparison. -->
      <div v-if="props.offers?.length" class="space-y-3">
        <h2 class="text-center font-display text-xl font-black uppercase text-neutral-900">وفّر أكثر مع العرض</h2>
        <div class="funnel-card flex items-center justify-between p-5">
          <span class="text-sm font-bold text-neutral-600">السعر العادي (قطعة واحدة)</span>
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="font-display text-lg font-black text-neutral-900" />
        </div>
        <button
          v-for="offer in props.offers"
          :key="offer.id"
          type="button"
          class="funnel-card relative flex w-full items-center justify-between gap-3 border-2 !border-primary-300 p-5 text-start"
          @click="selectOfferAndScroll(offer)"
        >
          <span v-if="offer.id === bestOffer?.id" class="absolute -top-2.5 start-4">
            <ImpulseBadge color="yellow" variant="solid">أفضل قيمة</ImpulseBadge>
          </span>
          <span class="text-sm font-bold text-neutral-900">
            <template v-if="offer.type === 'FixedBundlePrice'">اشترِ {{ offer.requiredQuantity }} مقابل <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
            <template v-else-if="offer.type === 'BuyXGetYFree'">اشترِ {{ offer.requiredQuantity }}، واحصل على {{ offer.freeQuantity }} مجاناً</template>
            <template v-else>اشترِ {{ offer.requiredQuantity }} — شحن مجاني</template>
          </span>
          <span v-if="offerSavingsCents(offer) > 0" class="shrink-0 text-sm font-black text-[var(--color-impulse-green)]">
            وفّر <PriceDisplay :amount-cents="offerSavingsCents(offer)" />
          </span>
        </button>
      </div>

      <!-- 8. Shipping & trust — existing risk-reversal badges (COD
           explanation, confirmation call, delivery coverage, easy return),
           unchanged component, moved right before the ask. -->
      <ImpulseTrustRow />

      <!-- 9. THE order form — untouched, byte-for-byte the same card as
           before (offer cards, variant picker, cart/lead fields, submit).
           Only its position on the page changed. -->
      <div id="impulse-order-form" class="funnel-card scroll-mt-24 space-y-4 border-2 !border-primary-300 p-6">
        <div class="text-center">
          <ImpulseBadge color="primary" variant="subtle">
            <Icon name="i-lucide-lock" class="size-3.5" />
            طلب آمن — يستغرق 30 ثانية
          </ImpulseBadge>
          <h2 class="mt-2 font-display text-2xl font-black uppercase text-neutral-900">
            <span class="marker">اطلب الآن</span> — ادفع عند الاستلام
          </h2>
        </div>

        <!-- Offer cards — best value flagged with real computed savings.
             Lives directly in the order form now, not its own card. -->
        <div v-if="props.offers?.length" class="space-y-2 text-start">
          <button
            v-for="offer in props.offers"
            :key="offer.id"
            type="button"
            class="relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition-all"
            :class="props.selectedOfferId === offer.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'"
            @click="props.onSelectOffer?.(offer)"
          >
            <span v-if="offer.id === bestOfferId" class="absolute -top-2.5 start-3">
              <ImpulseBadge color="yellow" variant="solid">أفضل قيمة</ImpulseBadge>
            </span>
            <span class="text-sm font-bold text-neutral-900">
              <template v-if="offer.type === 'FixedBundlePrice'">اشترِ {{ offer.requiredQuantity }} مقابل <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
              <template v-else-if="offer.type === 'BuyXGetYFree'">اشترِ {{ offer.requiredQuantity }}، واحصل على {{ offer.freeQuantity }} مجاناً</template>
              <template v-else>اشترِ {{ offer.requiredQuantity }} — شحن مجاني</template>
            </span>
            <span class="flex items-center gap-2">
              <span v-if="offerSavingsCents(offer) > 0" class="text-xs font-bold text-[var(--color-impulse-green)]">
                وفّر <PriceDisplay :amount-cents="offerSavingsCents(offer)" />
              </span>
              <Icon v-if="props.selectedOfferId === offer.id" name="i-lucide-check-circle" class="size-5 text-primary-600" />
            </span>
          </button>
        </div>

        <!-- Variant picker — lives directly in the order form now, not its
             own card. -->
        <div v-if="Object.keys(props.variantOptions).length" class="space-y-3">
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-2">
            <p class="text-xs font-bold uppercase tracking-wide text-neutral-600">اختر {{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="rounded-full border-2 px-5 py-2 text-sm font-bold transition-all"
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

        <!-- Cart mode -->
        <template v-if="props.displayCart !== false">
          <div class="flex items-center justify-center gap-3">
            <ImpulseQuantityStepper v-if="!props.product?.requireOfferSelection" :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
            <div class="text-end">
              <p class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">المجموع</p>
              <PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="font-display text-xl font-black text-neutral-900" />
            </div>
          </div>
          <ImpulseButton :disabled="!props.inStock || (props.product?.requireOfferSelection && !props.selectedOfferId)" size="xl" block pulse icon="i-lucide-shopping-cart" @click="props.onAddToCart">
            {{ props.inStock ? 'أضف إلى السلة' : 'غير متوفر' }}
          </ImpulseButton>
          <p v-if="props.added" class="text-center text-sm font-bold text-[var(--color-impulse-green)]">
            <Icon name="i-lucide-check-circle" class="me-1 inline size-4 align-[-2px]" />
            تمت الإضافة — انتقل إلى سلتك لإتمام الطلب.
          </p>
        </template>

        <!-- Lead form mode -->
        <template v-if="props.displayCart === false && props.inStock">
          <ImpulseLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
          <div class="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
            <ImpulseQuantityStepper v-if="!props.product?.requireOfferSelection" :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
            <div class="text-end">
              <p class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">المجموع — الدفع عند الاستلام</p>
              <PriceDisplay :amount-cents="(props.offerTotalCents ?? props.effectivePriceCents * props.quantity) + (props.leadShippingPriceCents ?? 0)" class="font-display text-xl font-black text-neutral-900" />
            </div>
          </div>
          <ImpulseButton size="xl" block pulse :loading="props.leadPlacing" trailing-icon="i-lucide-arrow-left" @click="props.onSubmitLead">
            تأكيد طلبي
          </ImpulseButton>
          <p v-if="props.leadError" class="text-center text-sm font-bold text-[var(--color-impulse-red)]">{{ props.leadError }}</p>
        </template>

        <p class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
          <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-impulse-green)]" />
          بدون دفع مسبق. نتصل بك للتأكيد قبل شحن أي شيء.
        </p>
      </div>

      <!-- 10. How it works — unchanged component, moved to right after the
           order form. -->
      <ImpulseSteps />

      <!-- Related — one last soft cross-sell, funnel-card ads. -->
      <div v-if="props.product.related?.length" class="space-y-3">
        <h2 class="text-center font-display text-xl font-black uppercase text-neutral-900">طلب العملاء أيضاً</h2>
        <div class="grid grid-cols-2 gap-3">
          <TemplateSection v-for="p in props.product.related.slice(0, 2)" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
      </div>

      <!-- 11. FAQ — admin-authored, only shown when filled in. -->
      <div v-if="props.product.faqs?.length" class="space-y-3">
        <h2 class="text-center font-display text-xl font-black uppercase text-neutral-900">الأسئلة الشائعة</h2>
        <details v-for="(faq, i) in props.product.faqs" :key="i" class="group funnel-card p-5">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-neutral-900">
            {{ faq.question }}
            <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
          </summary>
          <p class="mt-2 text-sm leading-relaxed text-neutral-600">{{ faq.answer }}</p>
        </details>
      </div>

      <!-- 12. Product specifications — admin-authored, compact/expandable,
           kept near the bottom so it never interrupts the conversion flow
           above. Only shown when filled in. -->
      <details v-if="props.product.specifications?.length" class="group funnel-card p-5">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-sm font-black uppercase text-neutral-900">
          المواصفات التقنية
          <Icon name="i-lucide-chevron-down" class="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
        </summary>
        <dl class="mt-3 divide-y divide-neutral-100 text-sm">
          <div v-for="(spec, i) in props.product.specifications" :key="i" class="flex justify-between gap-3 py-2">
            <dt class="text-neutral-500">{{ spec.label }}</dt>
            <dd class="font-bold text-neutral-900">{{ spec.value }}</dd>
          </div>
        </dl>
      </details>

      <!-- 13. Store trust — brief, non-fabricated recap of the same
           mechanics already established elsewhere on this page (COD, phone
           confirmation, real product data), not separate marketing claims. -->
      <div class="funnel-card space-y-2 p-6 text-center">
        <Icon name="i-lucide-shield-check" class="mx-auto size-6 text-[var(--color-impulse-green)]" />
        <h2 class="font-display text-sm font-black uppercase text-neutral-900">تسوق بثقة</h2>
        <p class="text-xs leading-relaxed text-neutral-500">
          الدفع عند الاستلام، بدون أي مبلغ مسبق — نتصل بك لتأكيد طلبك قبل شحنه، ونوصّله إلى باب منزلك في جميع الولايات الـ58.
        </p>
      </div>
    </div>

    <!-- 14. Sticky bottom order bar — the CTA never leaves the screen. -->
    <div v-if="props.inStock" class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-neutral-200 bg-white/95 py-3 shadow-[0_-8px_24px_-8px_rgba(28,23,18,0.18)] backdrop-blur-sm">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <p class="line-clamp-1 text-xs font-bold text-neutral-900">{{ props.product.name }}</p>
          <PriceDisplay :amount-cents="props.offerTotalCents ?? props.effectivePriceCents * props.quantity" class="font-display text-lg font-black text-primary-600" />
        </div>
        <ImpulseButton size="md" pulse trailing-icon="i-lucide-arrow-left" @click="onStickyCta">
          {{ props.displayCart === false ? 'اطلب الآن' : 'أضف إلى السلة' }}
        </ImpulseButton>
      </div>
    </div>
  </div>
</template>
