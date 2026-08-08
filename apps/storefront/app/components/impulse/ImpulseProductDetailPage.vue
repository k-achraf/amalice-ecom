<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Impulse PDP — the funnel's money page. Single centered column, ordered by
// the classic direct-response sequence (every block earns the scroll to the
// next): urgency countdown → social-proof header → gallery → price +
// savings → offer cards (best value flagged) → scarcity bar → variants →
// benefits checklist → THE order form with the pulsing CTA → trust row →
// how-it-works → testimonials → "customers also ordered". A sticky bottom
// order bar keeps the CTA on screen for the entire scroll. No @nuxt/ui.
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


// Per-offer savings vs buying the same units at the regular price — real
// math from the offers feature, no invented compare-at prices. The largest
// saver gets the "BEST VALUE" flag.
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

// Sticky bar CTA: lead mode scrolls to the order form; cart mode adds to
// cart directly.
function onStickyCta() {
  if (props.displayCart === false) {
    document.getElementById('impulse-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else {
    props.onAddToCart()
  }
}
</script>

<template>
  <div v-if="props.product" class="bg-neutral-50 pb-24">
    <div class="mx-auto max-w-2xl space-y-6 px-4 pt-8 sm:px-6">
      <!-- 2. Social-proof header — name framed by rating before price. -->
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

      <!-- 3. Gallery (or the AI landing-page long image when enabled). -->
      <img v-if="props.landingPageImageUrl" :src="props.landingPageImageUrl" :alt="props.product.name" class="w-full rounded-2xl" fetchpriority="high" />
      <div v-else class="space-y-3">
        <div class="funnel-card aspect-square overflow-hidden">
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
        <div v-if="props.galleryImages.length > 1" class="flex justify-center gap-2">
          <button
            v-for="(img, i) in props.galleryImages"
            :key="i"
            class="size-16 overflow-hidden rounded-xl border-2 transition-all"
            :class="i === props.activeImageIndex ? 'border-primary-500' : 'border-neutral-200 hover:border-primary-300'"
            @click="props.onSelectImage(i)"
          >
            <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="64" height="64" loading="lazy" />
          </button>
        </div>
      </div>

      <!-- 4. Price block — price + the free-delivery/COD value framing. -->
      <div class="funnel-card space-y-3 p-6 text-center">
        <div class="flex items-center justify-center gap-3">
          <PriceDisplay :amount-cents="props.effectivePriceCents" class="font-display text-4xl font-black text-neutral-900" />
          <ImpulseBadge v-if="!props.inStock" color="red" variant="solid">نفدت الكمية</ImpulseBadge>
        </div>
        <p class="text-xs font-semibold text-neutral-500">
          <Icon name="i-lucide-banknote" class="me-1 inline size-3.5 align-[-2px] text-[var(--color-impulse-green)]" />
          الدفع عند الاستلام — لا تدفع شيئاً حتى يصل الطلب إلى يديك
        </p>

        <!-- 5. Offer cards — best value flagged with real computed savings. -->
        <div v-if="props.offers?.length" class="space-y-2 pt-2 text-start">
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

        <!-- 6. Scarcity bar — real stock, striped animated fill. -->
        <ImpulseScarcity :stock="props.effectiveStock" :threshold="props.product.lowStockThreshold" class="pt-2" />
      </div>

      <!-- 7. Variants -->
      <div v-if="Object.keys(props.variantOptions).length" class="funnel-card space-y-4 p-6">
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
              {{ val }}
            </button>
          </div>
        </div>
      </div>

      <!-- 8. Product description — rendered as real HTML (headings, bold,
           lists, images, video) from the admin's rich-text editor, same as
           every other template's PDP. -->
      <div v-if="props.product.description && !props.landingPageImageUrl" class="funnel-card space-y-3 p-6">
        <h2 class="font-display text-lg font-black uppercase text-neutral-900">لماذا ستحبه</h2>
        <div class="product-description-html text-sm leading-relaxed text-neutral-700" v-html="sanitizeDescriptionHtml(props.product.description)" />
      </div>

      <!-- 9. THE order form — the funnel's single conversion point. -->
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

      <!-- 10 + 11. Reassurance stack right after the ask. -->
      <ImpulseTrustRow />
      <ImpulseSteps />

      <!-- 12. Testimonials — reviews as proof cards. -->
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

      <!-- 13. Related — one last soft cross-sell, funnel-card ads. -->
      <div v-if="props.product.related?.length" class="space-y-3">
        <h2 class="text-center font-display text-xl font-black uppercase text-neutral-900">طلب العملاء أيضاً</h2>
        <div class="grid grid-cols-2 gap-3">
          <TemplateSection v-for="p in props.product.related.slice(0, 2)" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
        </div>
      </div>
    </div>

    <!-- Sticky bottom order bar — the CTA never leaves the screen. -->
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
