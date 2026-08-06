<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, ProductOffer, RatingSummary, Review } from '@amalice/shared'
import { CheckoutSchema, offerTotalQuantity, offerPriceCents } from '@amalice/shared'

// LOGIC ONLY — presentation resolved by <TemplatePage name="ProductDetail">.
// When displayCart=true: the "Add to cart" button works normally.
// When displayCart=false: a lead-capture form replaces the add-to-cart button;
// the customer enters phone/address/qty directly → places order (lands in
// PendingCallCenter, a call-center agent confirms it by phone), all inline
// on the PDP (no cart).
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
  offers: ProductOffer[]
}

const route = useRoute()
const slug = route.params.slug as string
const sd = useStructuredData()
const settings = useStoreSettings()
const cart = useCartStore()

const { data: product, error } = await useApiFetch<RichProduct>(`/products/${slug}`)
if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Product not found' })
}

const { data: reviewData } = await useApiFetch<{ summary: RatingSummary; items: Review[] }>(
  `/products/${slug}/reviews`,
  { key: `reviews-${slug}` }
)

// AI landing pages (apps/api/src/landing-pages) are now standalone pages at
// their own URL (/lp/:productSlug/:number — see app/pages/lp/[productSlug]/[number].vue), never swapped
// into this normal product page. This page always shows the plain
// gallery+description; landingPageImageUrl stays wired into every
// template's ProductDetailPage props (always null) rather than removing the
// prop from all 15 template components for a behavior that no longer exists.
const landingPageImageUrl = null

useSeoMeta({
  title: () => product.value?.name,
  description: () => product.value?.description ?? `Buy ${product.value?.name} — cash on delivery.`
})

watchEffect(() => {
  if (product.value) {
    const images = product.value.images.length
      ? product.value.images.map((i) => i.url)
      : product.value.imageUrl
        ? [product.value.imageUrl]
        : []
    sd.product(product.value, { images, rating: reviewData.value?.summary })
    sd.breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/catalog' },
      ...(product.value.categoryRef
        ? [{ name: product.value.categoryRef.name, path: `/collections/${product.value.categoryRef.slug}` }]
        : []),
      { name: product.value.name, path: `/products/${slug}` }
    ])
  }
})

const quantity = ref(1)
const added = ref(false)
const selectedVariantId = ref<string | null>(null)
const activeImageIndex = ref(0)
const selectedOfferId = ref<string | null>(null)

const galleryImages = computed(() => {
  if (!product.value) return []
  if (product.value.images.length) return product.value.images.map((i) => ({ url: resolveImageUrl(i.url), alt: i.altText ?? product.value!.name }))
  if (product.value.imageUrl) return [{ url: resolveImageUrl(product.value.imageUrl), alt: product.value.name }]
  return []
})

const selectedVariant = computed(() => product.value?.variants.find((v) => v.id === selectedVariantId.value) ?? null)
const effectivePriceCents = computed(() => selectedVariant.value?.priceCents ?? product.value?.priceCents ?? 0)
const effectiveStock = computed(() => selectedVariant.value?.stockQuantity ?? product.value?.stockQuantity ?? 0)
const inStock = computed(() => effectiveStock.value > 0)

// ViewContent (both pixels) — Meta/TikTok's standard "product/landing page
// viewed" event, used for retargeting and catalog ad matching. Fires once
// per DISTINCT product, client-only (both pixel composables no-op on the
// server anyway). Keyed by product id rather than a plain boolean — Nuxt
// reuses this same page component instance when navigating client-side
// between two different products (same [slug].vue route, only the param
// changes), so a one-time boolean flag would fire for the first product
// viewed in a session and then silently never again for any other product
// browsed afterwards without a full page reload. This was the actual cause
// of "sometimes logged, sometimes not."
const viewContentFiredForProductId = ref<string | null>(null)
watchEffect(() => {
  if (product.value && import.meta.client && viewContentFiredForProductId.value !== product.value.id) {
    viewContentFiredForProductId.value = product.value.id
    useMetaPixel().trackEvent('ViewContent', {
      content_ids: [product.value.id],
      content_type: 'product',
      content_name: product.value.name,
      value: effectivePriceCents.value / 100,
      currency: 'DZD'
    })
    useTikTokPixel().trackEvent('ViewContent', {
      contents: [{ content_id: product.value.id, content_name: product.value.name, price: effectivePriceCents.value / 100 }],
      value: effectivePriceCents.value / 100,
      currency: 'DZD'
    })
    // First-party view-tracking (admin dashboard's traffic stats) — same
    // per-product-id re-fire guard as the pixel events above, for the same
    // reason (component instance reuse across client-side product-to-product
    // navigation).
    useViewTracking().recordView('Product', product.value.id)
  }
})

const variantOptions = computed(() => {
  if (!product.value?.variants.length) return {} as Record<string, Set<string>>
  const opts: Record<string, Set<string>> = {}
  for (const v of product.value.variants) {
    const attrs = v.attributes as Record<string, string>
    for (const [key, val] of Object.entries(attrs)) {
      if (!opts[key]) opts[key] = new Set()
      opts[key].add(val)
    }
  }
  return opts
})

function onSelectImage(i: number) {
  activeImageIndex.value = i
}
function onSelectVariantByKey(key: string, val: string) {
  selectedVariantId.value = product.value?.variants.find((v) => (v.attributes as Record<string, string>)[key] === val)?.id ?? null
}
function onUpdateQuantity(v: number) {
  quantity.value = v
  // A manual quantity change no longer matches whatever offer set it —
  // offers are picked as a whole card (see onSelectOffer), not auto-detected
  // from an arbitrary quantity.
  if (selectedOffer.value && offerTotalQuantity(selectedOffer.value) !== v) selectedOfferId.value = null
}
function onAddToCart() {
  if (!product.value || !inStock.value) return
  cart.addItem(product.value, quantity.value, selectedOffer.value, selectedVariant.value)
  added.value = true
  setTimeout(() => (added.value = false), 2000)
}

// ---- Offers (buy-X bundle price / buy-X-get-Y-free / free-shipping badge) ----
// Picking an offer card sets the quantity to exactly what it needs and locks
// in its pricing — not auto-detected from whatever quantity is already
// selected (see ProductOffer's Prisma model comment for why).
const selectedOffer = computed(() => product.value?.offers.find((o) => o.id === selectedOfferId.value) ?? null)
const offerTotalCents = computed(() =>
  selectedOffer.value ? offerPriceCents(selectedOffer.value, effectivePriceCents.value) : effectivePriceCents.value * quantity.value
)
function onSelectOffer(offer: ProductOffer) {
  // Clicking the already-selected offer card unselects it instead of being
  // a no-op — previously there was no way back to buying at plain
  // per-unit pricing/quantity once an offer was picked.
  if (selectedOfferId.value === offer.id) {
    selectedOfferId.value = null
    quantity.value = 1
    return
  }
  selectedOfferId.value = offer.id
  quantity.value = offerTotalQuantity(offer)
}

// ---- Lead form (displayCart=false) ----
// Dynamic: fields come from admin-configured leadFormConfig (StoreSettings).
// No OTP — the order is created as Confirmed directly via POST /orders/lead.
import { DEFAULT_LEAD_FORM_FIELDS, type LeadFormField } from '@amalice/shared'

const leadFields = computed<LeadFormField[]>(() => {
  const config = settings.value.leadFormConfig
  const fields = config && config.length > 0 ? config : DEFAULT_LEAD_FORM_FIELDS
  // productIds scoping: empty/undefined = every product (the original,
  // only behavior); non-empty = only shows on this product's lead form —
  // see StoreSettingsSchema's leadFormConfig comment.
  return fields.filter((f) => f.enabled !== false && (!f.productIds?.length || (product.value && f.productIds.includes(product.value.id))))
})

const leadFormData = reactive<Record<string, string>>({})
// Initialize reactive data when fields change
watchEffect(() => {
  for (const f of leadFields.value) {
    if (!(f.key in leadFormData)) {
      leadFormData[f.key] = ''
    }
  }
})

const leadPlacing = ref(false)
const leadError = ref<string | null>(null)

// Anti-double-submit / bot-pace signals — same reasoning as checkout.vue's
// placeOrder (see its comment): one idempotency key per genuinely new lead
// submission, reused across retries of that same attempt; formLoadedAt lets
// the server flag an implausibly fast submit. Client-only, since PDP is
// SSR-rendered but a lead submission only ever happens from a client click.
let leadIdempotencyKey = ''
let leadFormLoadedAt = 0
if (import.meta.client) {
  leadIdempotencyKey = crypto.randomUUID()
  leadFormLoadedAt = Date.now()
}

// ---- Abandoned-cart tracking (Impulse template only) ----
// If the customer types a phone number on the lead form and goes idle past
// the store's configured delay without submitting, auto-create the order as
// abandoned so call-center can follow up (see AbandonedLeadOrderSchema /
// OrdersService.createAbandonedOrder). Scoped to Impulse only per product
// decision — this same leadFormData/[slug].vue page is shared by every
// other template's lead-form flow too, but only Impulse's funnel design is
// meant to trigger this.
const abandonedOrderId = ref<string | null>(null)
let abandonedTimer: ReturnType<typeof setTimeout> | undefined

function stopAbandonedTimer() {
  if (abandonedTimer) clearTimeout(abandonedTimer)
  abandonedTimer = undefined
}

async function fireAbandonedOrder() {
  if (!product.value || abandonedOrderId.value || leadPlacing.value) return
  try {
    const apiClient = useApiClient()
    const created = await apiClient<{ id: string }>('/orders/abandoned', {
      method: 'POST',
      body: {
        fields: leadFormData,
        wilayaId: leadFormData.wilayaId || undefined,
        shippingType: leadFormData.shippingType || undefined,
        items: [{ productId: product.value.id, variantId: selectedVariantId.value ?? undefined, quantity: quantity.value, offerId: selectedOfferId.value ?? undefined }]
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
    if (abandonedOrderId.value || leadPlacing.value) return
    const phone = leadFormData.phone || leadFormData.phoneNumber
    stopAbandonedTimer()
    if (!phone?.trim()) return
    const delayMs = (settings.value.abandonedCartDelaySeconds || 60) * 1000
    abandonedTimer = setTimeout(fireAbandonedOrder, delayMs)
  },
  { deep: true }
)

onBeforeUnmount(stopAbandonedTimer)

// Priced client-side only for display (the "Total — cash on delivery" line);
// the API re-prices from WilayaShippingRate server-side and never trusts this.
const leadShippingPriceCents = computed(() => Number(leadFormData.shippingPriceCents) || 0)

async function onSubmitLead() {
  // Synchronous double-submit guard — see checkout.vue's placeOrder comment
  // for why this check must come before any await, not just rely on the
  // button's disabled/loading binding.
  if (leadPlacing.value) return
  if (!product.value) return
  // Validate required fields
  for (const f of leadFields.value) {
    if (f.required !== false && !leadFormData[f.key]?.trim()) {
      leadError.value = `${f.label} is required.`
      return
    }
  }
  if (!leadFormData.wilayaId || !leadFormData.shippingType) {
    leadError.value = 'Please select a shipping method.'
    return
  }
  stopAbandonedTimer()
  leadPlacing.value = true
  leadError.value = null
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
          items: [{ productId: product.value.id, variantId: selectedVariantId.value ?? undefined, quantity: quantity.value, offerId: selectedOfferId.value ?? undefined }],
          // Pixel match-quality context — see checkout.vue's placeOrder for
          // why no eventId is threaded through here either.
          tracking: { ...useMetaPixel().getFbCookies(), ...useTikTokPixel().getTtCookie() },
          // If this same funnel visit already created an abandoned order
          // (see fireAbandonedOrder above), update that row instead of
          // creating a second one.
          convertsAbandonedOrderId: abandonedOrderId.value ?? undefined,
          idempotencyKey: leadIdempotencyKey || undefined,
          formLoadedAt: leadFormLoadedAt || undefined
        }
      }
    )
    const enriched = {
      ...created,
      items: created.items.map((i) => ({ ...i, name: product.value!.name }))
    }
    sessionStorage.setItem(`amalice.order.${created.id}`, JSON.stringify(enriched))
    // Upsells system — see checkout.vue's placeOrder for why phone is
    // stashed here rather than passed as a URL query param.
    sessionStorage.setItem(`amalice.order.${created.id}.phone`, leadFormData.phone || leadFormData.phoneNumber || '')
    await navigateTo(`/orders/${created.id}/upsell`)
  } catch (err: unknown) {
    const data = (err as { data?: { message?: string } })?.data
    leadError.value = data?.message ?? 'Something went wrong. Please try again.'
  } finally {
    leadPlacing.value = false
  }
}
</script>

<template>
  <TemplatePage
    name="ProductDetail"
    :page-props="{
      product,
      reviewData,
      landingPageImageUrl,
      galleryImages,
      activeImageIndex: activeImageIndex ?? 0,
      quantity: quantity ?? 1,
      added: added ?? false,
      selectedVariantId,
      selectedVariant,
      effectivePriceCents,
      effectiveStock,
      inStock,
      variantOptions,
      displayCart: settings.displayCart,
      leadFields,
      leadFormData,
      leadPlacing: leadPlacing ?? false,
      leadError,
      offers: product?.offers ?? [],
      selectedOfferId,
      offerTotalCents,
      leadShippingPriceCents,
      onSelectImage,
      onSelectVariantByKey,
      onUpdateQuantity,
      onAddToCart,
      onSubmitLead,
      onSelectOffer
    }"
  />
</template>
