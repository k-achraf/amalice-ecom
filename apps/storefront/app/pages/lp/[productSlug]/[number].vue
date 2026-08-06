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
  // First-party view-tracking (admin dashboard's traffic stats) — entityId
  // is the landing page's own id (PublicLandingPageSchema exposes it for
  // exactly this), not the product's, so "landing page views" and "product
  // views" stay two distinct counters even though both fire from a page
  // reached via a product.
  useViewTracking().recordView('LandingPage', page.id)
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

// Anti-abuse pair, same convention as checkout.vue/products/[slug].vue: a
// client-generated idempotency key (one per genuinely-new submit attempt,
// reused across retries of THIS attempt) + a load timestamp the server uses
// to flag an implausibly-fast bot-like submit. Generated once, client-only.
let leadIdempotencyKey = ''
let leadFormLoadedAt = 0
if (import.meta.client) {
  leadIdempotencyKey = crypto.randomUUID()
  leadFormLoadedAt = Date.now()
}

// ---- Abandoned-cart tracking (Impulse template only) ----
// Same mechanism as the normal PDP (products/[slug].vue) — if the customer
// types a phone number and goes idle past the store's configured delay
// without submitting, auto-create the order as abandoned so call-center can
// follow up (see AbandonedLeadOrderSchema / OrdersService.createAbandonedOrder).
// Scoped to Impulse only, mirroring the PDP's own gate, even though every
// /lp page is itself an ad-funnel entry point — kept consistent with "same
// method as product page form" rather than silently widening the scope.
// Landing pages have no variant/offer concept (always a fixed single unit
// of one product), so the payload is simpler than the PDP's.
const abandonedOrderId = ref<string | null>(null)
let abandonedTimer: ReturnType<typeof setTimeout> | undefined

function stopAbandonedTimer() {
  if (abandonedTimer) clearTimeout(abandonedTimer)
  abandonedTimer = undefined
}

async function fireAbandonedOrder() {
  if (abandonedOrderId.value || placing.value) return
  try {
    const apiClient = useApiClient()
    const created = await apiClient<{ id: string }>('/orders/abandoned', {
      method: 'POST',
      body: {
        fields: leadFormData,
        wilayaId: leadFormData.wilayaId || undefined,
        shippingType: leadFormData.shippingType || undefined,
        items: [{ productId: page.product.id, quantity: 1 }]
      }
    })
    abandonedOrderId.value = created.id
  } catch {
    // Best-effort — a failed abandoned-cart capture must never surface to
    // the customer or block them from still completing checkout normally.
  }
}

watch(
  () => ({ ...leadFormData }),
  () => {
    if (settings.value.activeTemplate !== 'impulse') return
    if (abandonedOrderId.value || placing.value) return
    const phone = leadFormData.phone || leadFormData.phoneNumber
    stopAbandonedTimer()
    if (!phone?.trim()) return
    const delayMs = (settings.value.abandonedCartDelaySeconds || 60) * 1000
    abandonedTimer = setTimeout(fireAbandonedOrder, delayMs)
  },
  { deep: true }
)

onBeforeUnmount(stopAbandonedTimer)

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
  stopAbandonedTimer()
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
          tracking: { ...metaPixel.getFbCookies(), ...tiktokPixel.getTtCookie() },
          convertsAbandonedOrderId: abandonedOrderId.value ?? undefined,
          idempotencyKey: leadIdempotencyKey || undefined,
          formLoadedAt: leadFormLoadedAt || undefined
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

    <TemplateSection
      name="LandingPageLeadCard"
      :section-props="{
        product: page.product,
        fields: leadFields,
        data: leadFormData,
        submitting: placing,
        error: placeError,
        onSubmit: onSubmitLead
      }"
    />
  </div>
</template>
