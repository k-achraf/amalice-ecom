<script setup lang="ts">
import type { LeadFormField, ProductOffer, ProductVariant, VariantSwatches } from '@amalice/shared'

// Quartz's lead-capture block for the AI landing-page funnel
// (app/pages/lp/[productSlug]/[number].vue) — the closest match to the
// reference COD order page this template recreates: a generated hero image
// (rendered by the page itself, above this component) followed directly by
// variant pills, an order form, an itemized product/delivery/total price
// table, and the buy button. GENERIC BY DESIGN — same note as
// QuartzProductDetailPage.vue: no wording assumes a specific product type,
// since this template can be assigned to any store.
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

function swatchColor(key: string, val: string): string | undefined {
  return props.product.variantSwatches?.[key]?.[val]
}

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

// The lp route never has a "leadShippingPriceCents" prop threaded through
// (see app/pages/lp/[productSlug]/[number].vue's TemplateSection call) —
// QuartzLeadFormFields writes the selected delivery price straight into
// `data.shippingPriceCents` (a string), so read it from there directly,
// same as the reference page's own "سعر التوصيل" row does.
const shippingCents = computed(() => Number(props.data.shippingPriceCents || 0))
const grandTotalCents = computed(() => props.offerTotalCents + shippingCents.value)
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 pb-24 pt-6 sm:px-6">
    <div class="space-y-1.5 text-center">
      <h1 class="font-display text-2xl font-medium leading-snug text-neutral-900">{{ product.name }}</h1>
      <PriceDisplay :amount-cents="offerTotalCents" class="font-display text-2xl font-semibold text-neutral-900" />
    </div>

    <!-- Variant pills -->
    <div v-if="Object.keys(variantOptions).length" class="space-y-3">
      <div v-for="(values, key) in variantOptions" :key="key" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">{{ key }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="val in values"
            :key="val"
            type="button"
            class="rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-all"
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

    <!-- Order card -->
    <div id="quartz-order-form" class="quartz-card scroll-mt-24 space-y-4 p-5">
      <div v-if="offers.length" class="space-y-2">
        <button
          v-for="offer in offers"
          :key="offer.id"
          type="button"
          class="relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition-all"
          :class="selectedOfferId === offer.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-primary-300'"
          @click="onSelectOffer(offer)"
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

      <QuartzLeadFormFields :fields="fields" :data="data" />

      <div v-if="!product.requireOfferSelection" class="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-2.5">
        <span class="text-sm font-semibold text-neutral-700">الكمية</span>
        <div class="flex items-center gap-3">
          <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600 disabled:opacity-40" :disabled="quantity <= 1" @click="onUpdateQuantity(quantity - 1)">−</button>
          <span class="min-w-4 text-center text-sm font-bold text-neutral-900">{{ quantity }}</span>
          <button type="button" class="flex size-7 items-center justify-center rounded-full border border-neutral-300 font-bold text-neutral-600" @click="onUpdateQuantity(quantity + 1)">+</button>
        </div>
      </div>

      <!-- Itemized price table — recreates the reference page's
           "سعر المنتج / سعر التوصيل / المجموع" rows exactly. -->
      <div class="price-table">
        <div class="price-row"><span>سعر المنتج</span><PriceDisplay :amount-cents="offerTotalCents" /></div>
        <div class="price-row">
          <span>سعر التوصيل</span>
          <PriceDisplay v-if="data.shippingType" :amount-cents="shippingCents" />
          <span v-else class="text-neutral-400">—</span>
        </div>
        <div class="price-row total"><span>المجموع</span><PriceDisplay :amount-cents="grandTotalCents" /></div>
      </div>

      <QuartzButton size="xl" block shine :loading="submitting" trailing-icon="i-lucide-arrow-left" @click="onSubmit">
        اشتري الآن — <PriceDisplay :amount-cents="grandTotalCents" />
      </QuartzButton>
      <p v-if="error" class="text-center text-sm font-semibold text-[var(--color-quartz-red)]">{{ error }}</p>

      <p class="flex items-center justify-center gap-1.5 text-[11px] font-medium text-neutral-400">
        <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-quartz-green)]" />
        بدون دفع مسبق. نتصل بك للتأكيد قبل شحن أي شيء.
      </p>
    </div>

    <QuartzTrustRow />
  </div>
</template>
