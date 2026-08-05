<script setup lang="ts">
import type { LeadFormField } from '@amalice/shared'

// Default/fallback lead-capture block for the AI landing-page funnel
// (app/pages/lp/[productSlug]/[number].vue) — used for any template that
// doesn't have its own bespoke variant registered in TemplateSection.vue's
// LandingPageLeadCard map (currently only `impulse` does — see
// impulse/ImpulseLandingPageLeadCard.vue). Still resolves LeadFormFields and
// Button per the active template via TemplateSection, so even a template
// without its own full card still gets its own form-field styling and
// button, just in this generic layout shell.
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
  <div class="mx-auto max-w-md space-y-4 px-4 py-8">
    <div class="text-center">
      <h1 class="text-lg font-semibold text-highlighted">{{ product.name }}</h1>
      <PriceDisplay :amount-cents="product.priceCents" class="text-xl font-bold text-primary" />
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
