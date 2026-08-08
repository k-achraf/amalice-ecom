<script setup lang="ts">
import type { LeadFormField, ProductOffer, ProductVariant } from '@amalice/shared'
import { offerPriceCents } from '@amalice/shared'

// Default/fallback lead-capture block for the AI landing-page funnel
// (app/pages/lp/[productSlug]/[number].vue) — used for any template that
// doesn't have its own bespoke variant registered in TemplateSection.vue's
// LandingPageLeadCard map (currently only `impulse` does — see
// impulse/ImpulseLandingPageLeadCard.vue). Still resolves LeadFormFields and
// Button per the active template via TemplateSection, so even a template
// without its own full card still gets its own form-field styling and
// button, just in this generic layout shell.
const props = defineProps<{
  product: { name: string; priceCents: number; requireOfferSelection: boolean; variants: ProductVariant[]; offers: ProductOffer[] }
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

// Per-offer savings vs buying the same units at the regular price.
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
</script>

<template>
  <div class="mx-auto max-w-md space-y-4 px-4 py-8">
    <div class="text-center">
      <h1 class="text-lg font-semibold text-highlighted">{{ product.name }}</h1>
      <PriceDisplay :amount-cents="offerTotalCents" class="text-xl font-bold text-primary" />
    </div>

    <!-- Offer cards — only shown when the product has enabled offers -->
    <div v-if="offers.length" class="space-y-2">
      <p class="text-sm font-semibold text-highlighted">اختر العرض</p>
      <button
        v-for="offer in offers"
        :key="offer.id"
        type="button"
        class="relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition-all"
        :class="selectedOfferId === offer.id ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'"
        @click="onSelectOffer(offer)"
      >
        <span v-if="offer.id === bestOfferId" class="absolute -top-2.5 start-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
          أفضل قيمة
        </span>
        <span class="text-sm font-bold text-highlighted">
          <template v-if="offer.type === 'FixedBundlePrice'">اشترِ {{ offer.requiredQuantity }} مقابل <PriceDisplay :amount-cents="offer.bundlePriceCents ?? 0" /></template>
          <template v-else-if="offer.type === 'BuyXGetYFree'">اشترِ {{ offer.requiredQuantity }}، واحصل على {{ offer.freeQuantity }} مجاناً</template>
          <template v-else>اشترِ {{ offer.requiredQuantity }} — شحن مجاني</template>
        </span>
        <span class="flex items-center gap-2">
          <span v-if="offerSavingsCents(offer) > 0" class="text-xs font-bold text-success">
            وفّر <PriceDisplay :amount-cents="offerSavingsCents(offer)" />
          </span>
          <Icon v-if="selectedOfferId === offer.id" name="i-lucide-check-circle" class="size-5 text-primary" />
        </span>
      </button>
    </div>

    <!-- Variant picker — only shown when the product has variants -->
    <div v-if="Object.keys(variantOptions).length" class="space-y-3">
      <div v-for="(values, key) in variantOptions" :key="key" class="space-y-2">
        <p class="text-xs font-bold uppercase tracking-wide text-muted">اختر {{ key }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="val in values"
            :key="val"
            type="button"
            class="rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-all"
            :class="selectedVariant?.attributes[key] === val
              ? 'border-primary bg-primary text-white'
              : 'border-muted text-highlighted hover:border-primary/50'"
            @click="onSelectVariantByKey(key, val)"
          >
            {{ val }}
          </button>
        </div>
      </div>
    </div>

    <!-- Quantity stepper — only shown when no offer is selected and requireOfferSelection is false -->
    <div v-if="!selectedOfferId && !product.requireOfferSelection" class="flex items-center gap-3">
      <p class="text-sm font-semibold text-highlighted">الكمية</p>
      <div class="flex items-center gap-2 rounded-lg border-2 border-muted px-3 py-1">
        <button type="button" class="font-bold text-muted transition hover:text-highlighted" :disabled="quantity <= 1" @click="onUpdateQuantity(quantity - 1)">−</button>
        <span class="min-w-6 text-center text-sm font-bold text-highlighted">{{ quantity }}</span>
        <button type="button" class="font-bold text-muted transition hover:text-highlighted" @click="onUpdateQuantity(quantity + 1)">+</button>
      </div>
    </div>

    <TemplateSection name="LeadFormFields" :section-props="{ fields, data }" />

    <p v-if="error" class="text-sm text-error">{{ error }}</p>

    <TemplateSection
      name="Button"
      :section-props="{ loading: submitting, block: true, size: 'lg', type: 'button', onClick: onSubmit }"
    >
      اطلب الآن — الدفع عند الاستلام
    </TemplateSection>
  </div>
</template>
