<script setup lang="ts">
import type { LeadFormField } from '@amalice/shared'

// Faithful recreation of Impulse's own PDP lead-capture block (see the
// `displayCart === false` branch in ImpulseProductDetailPage.vue) for the
// AI landing-page funnel — same urgency countdown band, funnel-card price
// treatment, COD reassurance line, ImpulseLeadFormFields, pulsing
// ImpulseButton CTA, and trust row. Deliberately identical classes/
// components to the PDP, not a re-styled approximation, per the explicit
// "same UI, same colors, same animations and effects" request.
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
</script>

<template>
  <div class="pb-16">
    <!-- 1. Urgency band — the same first-thing-under-the-header treatment
         Impulse's own PDP uses (there, right under ImpulseHeader; here,
         right under the funnel image since this route has no header). -->
    <div class="border-b border-neutral-200 bg-white py-3">
      <ImpulseCountdown />
    </div>

    <div class="mx-auto max-w-2xl space-y-6 px-4 pt-6 sm:px-6">
      <!-- 2. Price + COD reassurance card. -->
      <div class="funnel-card space-y-3 p-6 text-center">
        <h1 class="line-clamp-2 font-display text-lg font-black text-neutral-900">{{ product.name }}</h1>
        <div class="flex items-center justify-center gap-3">
          <PriceDisplay :amount-cents="product.priceCents" class="font-display text-4xl font-black text-neutral-900" />
          <ImpulseBadge color="green" variant="subtle">
            <Icon name="i-lucide-truck" class="size-3.5" />
            توصيل مجاني
          </ImpulseBadge>
        </div>
        <p class="text-xs font-semibold text-neutral-500">
          <Icon name="i-lucide-banknote" class="me-1 inline size-3.5 align-[-2px] text-[var(--color-impulse-green)]" />
          الدفع عند الاستلام — لا تدفع شيئاً حتى يصل الطلب إلى يديك
        </p>
      </div>

      <!-- 3. Lead form + CTA — same fields component and same pulsing button
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

      <!-- 4. Trust row — the same 4 risk-reversal signals repeated near the
           ask on the PDP. -->
      <ImpulseTrustRow />
    </div>
  </div>
</template>
