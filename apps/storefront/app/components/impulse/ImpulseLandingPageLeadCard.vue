<script setup lang="ts">
import type { LeadFormField } from '@amalice/shared'

// Faithful recreation of Impulse's own PDP lead-capture block (see the
// `displayCart === false` branch in ImpulseProductDetailPage.vue) for the
// AI landing-page funnel — same funnel-card price treatment, COD
// reassurance line, ImpulseLeadFormFields, pulsing ImpulseButton CTA, trust
// row, AND the same sticky bottom order bar that keeps the CTA on screen
// through the whole scroll. Deliberately identical classes/components to
// the PDP, not a re-styled approximation, per the explicit "same UI, same
// colors, same animations and effects" request. No urgency countdown / free-
// shipping badge — removed from both here and the PDP itself (account
// owner's call: no fabricated urgency deadline, no free-delivery claim).
//
// Omitted vs. the PDP: variant picker, quantity stepper, per-offer bundle
// cards, and the real-time-stock scarcity bar — all of those need live
// cart/stock data a standalone landing page doesn't have (PublicLandingPage,
// packages/shared/src/landing-page.ts, only carries id/name/slug/
// priceCents/imageUrl). A landing page is always a fixed single unit of one
// product, no cart, no variants — there's nothing for those to control.
defineProps<{
  product: { name: string; priceCents: number }
  fields: LeadFormField[]
  data: Record<string, string>
  submitting: boolean
  error: string | null
  onSubmit: () => void
}>()

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
          <PriceDisplay :amount-cents="product.priceCents" class="font-display text-4xl font-black text-neutral-900" />
        </div>
        <p class="text-xs font-semibold text-neutral-500">
          <Icon name="i-lucide-banknote" class="me-1 inline size-3.5 align-[-2px] text-[var(--color-impulse-green)]" />
          الدفع عند الاستلام — لا تدفع شيئاً حتى يصل الطلب إلى يديك
        </p>
      </div>

      <!-- 2. Lead form + CTA — same fields component and same pulsing button
           as the PDP's lead-form mode. -->
      <div id="impulse-order-form" class="funnel-card space-y-4 p-6">
        <ImpulseLeadFormFields :fields="fields" :data="data" />
        <ImpulseButton size="xl" block pulse :loading="submitting" trailing-icon="i-lucide-arrow-left" @click="onSubmit">
          تأكيد طلبي
        </ImpulseButton>
        <p v-if="error" class="text-center text-sm font-bold text-[var(--color-impulse-red)]">{{ error }}</p>
      </div>

      <p class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
        <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-impulse-green)]" />
        بدون دفع مسبق. نتصل بك للتأكيد قبل شحن أي شيء.
      </p>

      <!-- 3. Trust row — the same 4 risk-reversal signals repeated near the
           ask on the PDP. -->
      <ImpulseTrustRow />
    </div>

    <!-- 4. Sticky bottom order bar — identical to the PDP's, keeps the CTA
         on screen through the whole scroll. -->
    <div class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-neutral-200 bg-white/95 py-3 shadow-[0_-8px_24px_-8px_rgba(28,23,18,0.18)] backdrop-blur-sm">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
        <div>
          <p class="line-clamp-1 text-xs font-bold text-neutral-900">{{ product.name }}</p>
          <PriceDisplay :amount-cents="product.priceCents" class="font-display text-lg font-black text-primary-600" />
        </div>
        <ImpulseButton size="md" pulse trailing-icon="i-lucide-arrow-left" @click="scrollToForm">
          اطلب الآن
        </ImpulseButton>
      </div>
    </div>
  </div>
</template>
