<script setup lang="ts">
import { DEFAULT_LEAD_FORM_FIELDS, type LeadFormField, type PublicLandingPage } from '@amalice/shared'

// AI landing-page funnel route — chromeless (no header/nav), a single
// full-width generated image with a lead form at the bottom. This is a
// SEPARATE, standalone URL from the normal /products/:slug page (never
// swaps into it — see that page's own comment) — a product reached this way
// is reached via a different creative angle/ad campaign, not the catalog.
// URL is /lp/:productSlug/:number — never a raw id/uuid — :number just
// distinguishes multiple landing pages for the same product (1, 2, 3, ...).
//
// Layout is picked dynamically to ALWAYS match the store's currently active
// template (app/layouts/blank-<template>.vue — same palette/footer as that
// template's normal layout, just without its header), not a fixed generic
// one — see setPageLayout() below. `blank.vue` (no suffix) is the fallback
// for the `minimal` template, which has no dedicated palette CSS of its own.
const route = useRoute()
const productSlug = route.params.productSlug as string
const number = route.params.number as string
const settings = useStoreSettings()
const metaPixel = useMetaPixel()
const tiktokPixel = useTikTokPixel()

const layoutName = computed(() => {
  const t = settings.value.activeTemplate
  return t === 'minimal' ? 'blank' : `blank-${t}`
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- setPageLayout's generic type only accepts the
// closed union of generated layout-file names as a literal; this is chosen dynamically from the active store
// template (always a valid layout name, just not expressible as that literal union here).
setPageLayout(layoutName.value as any)

const { data: landingPage, error } = await useApiFetch<PublicLandingPage>(`/landing-pages/${productSlug}/${number}`, {
  key: `lp-${productSlug}-${number}`
})
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

      <TemplateSection name="LeadFormFields" :section-props="{ fields: leadFields, data: leadFormData }" />

      <p v-if="placeError" class="text-sm text-error">{{ placeError }}</p>

      <TemplateSection
        name="Button"
        :section-props="{ loading: placing, block: true, size: 'lg', type: 'button', onClick: onSubmitLead }"
      >
        اطلب الآن — الدفع عند الاستلام
      </TemplateSection>
    </div>
  </div>
</template>
