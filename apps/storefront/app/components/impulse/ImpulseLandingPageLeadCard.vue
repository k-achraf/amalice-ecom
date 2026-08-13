<script setup lang="ts">
import type { LeadFormField, ProductOffer, ProductVariant, VariantSwatches } from '@amalice/shared'

// Faithful recreation of Impulse's own PDP lead-capture block (see the
// `displayCart === false` branch in ImpulseProductDetailPage.vue) for the
// AI landing-page funnel — same funnel-card price treatment, COD
// reassurance line, ImpulseLeadFormFields, pulsing ImpulseButton CTA, trust
// row, AND the same sticky bottom order bar that keeps the CTA on screen
// through the whole scroll. Deliberately identical classes/components to
// the PDP, not a re-styled approximation. No urgency countdown / free-
// shipping badge — removed from both here and the PDP itself.
//
// Now fully mirrors the PDP's offer-card and variant-picker UI — the same
// markup from ImpulseProductDetailPage.vue — plus a quantity stepper and
// total price line above the CTA.
const props = defineProps<{
  product: { name: string; priceCents: number; requireOfferSelection: boolean; variants: ProductVariant[]; offers: ProductOffer[]; variantSwatches?: VariantSwatches }
  fields: LeadFormField[]
  data: Record<string, string>
  submitting: boolean
  error: string | null
  offers: ProductOffer[]
  selectedOfferId: string | null
  offerTotalCents: number
  quantity: number
  variantOptions: Record<string, Set<string>>
  selectedVariant: ProductVariant | null
  onSubmit: () => void
  onSelectOffer: (offer: ProductOffer) => void
  onSelectVariantByKey: (key: string, val: string) => void
  onUpdateQuantity: (v: number) => void
}>()

// See VariantSwatchesSchema's comment (packages/shared/src/catalog.ts) — undefined
// for a non-color attribute or a color option with no hex set.
function swatchColor(key: string, val: string): string | undefined {
  return props.product.variantSwatches?.[key]?.[val]
}

// Per-offer savings — real math, same as ImpulseProductDetailPage's
// offerSavingsCents. Largest saver gets the "BEST VALUE" badge.
function offerSavingsCents(offer: ProductOffer) {
  if (offer.type === 'FixedBundlePrice') {
    return Math.max(0, props.product.priceCents * offer.requiredQuantity - (offer.bundlePriceCents ?? 0))
  }
  if (offer.type === 'BuyXGetYFree') return props.product.priceCents * offer.freeQuantity
  return 0
}
const bestOfferId = computed(() => {
  if (!props.offers.length) return null
  let best: ProductOffer | null = null
  for (const offer of props.offers) {
    if (!best || offerSavingsCents(offer) > offerSavingsCents(best)) best = offer
  }
  return best && offerSavingsCents(best) > 0 ? best.id : null
})

// Same behavior as the PDP's onStickyCta when displayCart===false — this
// route is always "lead mode" (no cart), so the sticky bar's job is only
// ever to bring the order form into view, never to add-to-cart.
function scrollToForm() {
  document.getElementById('impulse-order-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <div class="pb-24">
    <div class="mx-auto max-w-2xl space-y-6 px-4 pt-6 sm:px-6">
      <!-- 1. Price + COD reassurance card. -->
      <div class="funnel-card space-y-3 p-6 text-center">
        <h1 class="line-clamp-2 font-display text-lg font-black text-neutral-900">{{ product.name }}</h1>
        <div class="flex items-center justify-center gap-3">
          <PriceDisplay :amount-cents="offerTotalCents" class="font-display text-4xl font-black text-neutral-900" />
        </div>
        <p class="text-xs font-semibold text-neutral-500">
          <Icon name="i-lucide-banknote" class="me-1 inline size-3.5 align-[-2px] text-[var(--color-impulse-green)]" />
          الدفع عند الاستلام — لا تدفع شيئاً حتى يصل الطلب إلى يديك
        </p>

        <!-- 2. Offer cards — same markup as ImpulseProductDetailPage, section 5. -->
        <div v-if="offers.length" class="space-y-2 pt-2 text-start">
          <button
            v-for="offer in offers"
            :key="offer.id"
            type="button"
            class="relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition-all"
            :class="selectedOfferId === offer.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'"
            @click="onSelectOffer(offer)"
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
              <Icon v-if="selectedOfferId === offer.id" name="i-lucide-check-circle" class="size-5 text-primary-600" />
            </span>
          </button>
        </div>
      </div>

      <!-- 3. Variant picker — same pill-button style as ImpulseProductDetailPage, section 7. -->
      <div v-if="Object.keys(variantOptions).length" class="funnel-card space-y-4 p-6">
        <div v-for="(values, key) in variantOptions" :key="key" class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-neutral-600">اختر {{ key }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="val in values"
              :key="val"
              type="button"
              class="rounded-full border-2 px-5 py-2 text-sm font-bold transition-all"
              :class="selectedVariant?.attributes[key] === val
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-neutral-200 text-neutral-700 hover:border-primary-300'"
              @click="onSelectVariantByKey(key, val)"
            >
              <span v-if="swatchColor(key, val)" class="me-1.5 inline-block size-3 rounded-full border border-black/15 align-middle" :style="{ backgroundColor: swatchColor(key, val) }" />{{ val }}
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Lead form + quantity + total + CTA — mirrors the PDP's lead-form mode. -->
      <div id="impulse-order-form" class="funnel-card space-y-4 p-6">
        <ImpulseLeadFormFields :fields="fields" :data="data" />

        <!-- Quantity stepper + total — hidden when an offer is active (offer sets the quantity) -->
        <div class="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <ImpulseQuantityStepper
            v-if="!selectedOfferId && !product.requireOfferSelection"
            :model-value="quantity"
            :min="1"
            @update:model-value="onUpdateQuantity"
          />
          <div class="text-end">
            <p class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">المجموع — الدفع عند الاستلام</p>
            <PriceDisplay :amount-cents="offerTotalCents" class="font-display text-xl font-black text-neutral-900" />
          </div>
        </div>

        <ImpulseButton size="xl" block pulse :loading="submitting" trailing-icon="i-lucide-arrow-left" @click="onSubmit">
          تأكيد طلبي
        </ImpulseButton>
        <p v-if="error" class="text-center text-sm font-bold text-[var(--color-impulse-red)]">{{ error }}</p>
      </div>

      <p class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
        <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-impulse-green)]" />
        بدون دفع مسبق. نتصل بك للتأكيد قبل شحن أي شيء.
      </p>

      <!-- 5. Trust row — the same 4 risk-reversal signals repeated near the ask. -->
      <ImpulseTrustRow />
    </div>

    <!-- 6. Sticky bottom order bar — keeps the CTA on screen through the whole scroll. -->
    <div class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-neutral-200 bg-white/95 py-3 shadow-[0_-8px_24px_-8px_rgba(28,23,18,0.18)] backdrop-blur-sm">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <p class="line-clamp-1 text-xs font-bold text-neutral-900">{{ product.name }}</p>
          <PriceDisplay :amount-cents="offerTotalCents" class="font-display text-lg font-black text-primary-600" />
        </div>
        <ImpulseButton size="md" pulse trailing-icon="i-lucide-arrow-left" @click="scrollToForm">
          اطلب الآن
        </ImpulseButton>
      </div>
    </div>
  </div>
</template>
