<script setup lang="ts">
import { DEFAULT_LEAD_FORM_FIELDS, type LeadFormField, type PublicLandingPage } from '@amalice/shared'

// AI landing-page funnel route — chromeless (see layouts/blank.vue), a
// single full-width generated image with a lead form at the bottom. This is
// a SEPARATE, standalone URL from the normal /products/:slug page (never
// swaps into it — see that page's own comment) — a product reached this way
// is reached via a different creative angle/ad campaign, not the catalog.
definePageMeta({ layout: 'blank' })

const route = useRoute()
const slug = route.params.slug as string
const settings = useStoreSettings()
const metaPixel = useMetaPixel()
const tiktokPixel = useTikTokPixel()

const { data: landingPage, error } = await useApiFetch<PublicLandingPage>(`/landing-pages/${slug}`, { key: `lp-${slug}` })
if (error.value || !landingPage.value) {
  throw createError({ statusCode: 404, statusMessage: 'Landing page not found' })
}
const page = landingPage.value

useSeoMeta({
  title: page.product.name,
  description: () => `${page.product.name} — الدفع عند الاستلام`,
  ogImage: resolveImageUrl(page.finalImageUrl)
})

// Same "reached a real product, worth an ad-attribution signal" event the
// normal PDP fires, since this route only ever exists as an ad-funnel entry
// point.
if (import.meta.client) {
  metaPixel.trackEvent('ViewContent', {
    content_ids: [page.product.id],
    content_type: 'product',
    value: page.product.priceCents / 100,
    currency: 'DZD'
  })
  tiktokPixel.trackEvent('ViewContent', {
    contents: [{ content_id: page.product.id, content_type: 'product', price: page.product.priceCents / 100 }],
    value: page.product.priceCents / 100,
    currency: 'DZD'
  })
}

const leadFields = computed<LeadFormField[]>(() => {
  const config = settings.value.leadFormConfig
  return (config && config.length > 0 ? config : DEFAULT_LEAD_FORM_FIELDS).filter((f) => f.enabled !== false)
})

const leadFormData = reactive<Record<string, string>>({})
watchEffect(() => {
  for (const f of leadFields.value) {
    if (!(f.key in leadFormData)) leadFormData[f.key] = ''
  }
})

const placing = ref(false)
const placeError = ref<string | null>(null)

async function onSubmitLead() {
  for (const f of leadFields.value) {
    if (f.required !== false && !leadFormData[f.key]?.trim()) {
      placeError.value = `${f.label} مطلوب.`
      return
    }
  }
  if (!leadFormData.wilayaId || !leadFormData.shippingType) {
    placeError.value = 'الرجاء اختيار طريقة التوصيل.'
    return
  }
  placing.value = true
  placeError.value = null
  try {
    const apiClient = useApiClient()
    const created = await apiClient<{ id: string; totalCents: number; state: string; createdAt: string; items: { productId: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[] }>(
      '/orders/lead',
      {
        method: 'POST',
        body: {
          fields: leadFormData,
          wilayaId: leadFormData.wilayaId,
          shippingType: leadFormData.shippingType,
          items: [{ productId: page.product.id, quantity: 1 }],
          tracking: { ...metaPixel.getFbCookies(), ...tiktokPixel.getTtCookie() }
        }
      }
    )
    const enriched = { ...created, items: created.items.map((i) => ({ ...i, name: page.product.name })) }
    sessionStorage.setItem(`amalice.order.${created.id}`, JSON.stringify(enriched))
    sessionStorage.setItem(`amalice.order.${created.id}.phone`, leadFormData.phone || leadFormData.phoneNumber || '')
    await navigateTo(`/orders/${created.id}/upsell`)
  } catch (err: unknown) {
    const data = (err as { data?: { message?: string } })?.data
    placeError.value = data?.message ?? 'حدث خطأ ما. الرجاء المحاولة مرة أخرى.'
  } finally {
    placing.value = false
  }
}
</script>

<template>
  <div>
    <img
      :src="resolveImageUrl(page.finalImageUrl)"
      :alt="page.product.name"
      class="w-full"
      loading="eager"
      fetchpriority="high"
    >

    <div class="mx-auto max-w-md space-y-4 px-4 py-8">
      <div class="text-center">
        <h1 class="text-lg font-semibold text-highlighted">{{ page.product.name }}</h1>
        <PriceDisplay :amount-cents="page.product.priceCents" class="text-xl font-bold text-primary" />
      </div>

      <LeadFormFields :fields="leadFields" :data="leadFormData" />

      <p v-if="placeError" class="text-sm text-error">{{ placeError }}</p>

      <Button :loading="placing" class="w-full" size="lg" @click="onSubmitLead">
        اطلب الآن — الدفع عند الاستلام
      </Button>
    </div>
  </div>
</template>
