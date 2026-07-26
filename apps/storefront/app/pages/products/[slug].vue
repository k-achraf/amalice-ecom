<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review } from '@amalice/shared'
import { CheckoutSchema } from '@amalice/shared'

// LOGIC ONLY — presentation resolved by <TemplatePage name="ProductDetail">.
// When displayCart=true: the "Add to cart" button works normally.
// When displayCart=false: a lead-capture form replaces the add-to-cart button;
// the customer enters phone/address/qty directly → places order → OTP verify,
// all inline on the PDP (no cart). The shared useOrderPlacement() composable
// handles the order+OTP flow without duplicating checkout.vue's logic.
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
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
}
function onAddToCart() {
  if (!product.value || !inStock.value) return
  cart.addItem(product.value, quantity.value)
  added.value = true
  setTimeout(() => (added.value = false), 2000)
}

// ---- Lead form (displayCart=false) ----
// Dynamic: fields come from admin-configured leadFormConfig (StoreSettings).
// No OTP — the order is created as Confirmed directly via POST /orders/lead.
import { DEFAULT_LEAD_FORM_FIELDS, type LeadFormField } from '@amalice/shared'

const leadFields = computed<LeadFormField[]>(() => {
  const config = settings.value.leadFormConfig
  return (config && config.length > 0 ? config : DEFAULT_LEAD_FORM_FIELDS).filter(f => f.enabled !== false)
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

async function onSubmitLead() {
  if (!product.value) return
  // Validate required fields
  for (const f of leadFields.value) {
    if (f.required !== false && !leadFormData[f.key]?.trim()) {
      leadError.value = `${f.label} is required.`
      return
    }
  }
  leadPlacing.value = true
  leadError.value = null
  try {
    const apiClient = useApiClient()
    const created = await apiClient<{ id: string; totalCents: number; state: string; createdAt: string; items: { productId: string; quantity: number; unitPriceCents: number }[] }>(
      '/orders/lead',
      {
        method: 'POST',
        body: {
          fields: leadFormData,
          items: [{ productId: product.value.id, quantity: quantity.value }]
        }
      }
    )
    const enriched = {
      ...created,
      items: created.items.map((i) => ({ ...i, name: product.value!.name }))
    }
    sessionStorage.setItem(`amalice.order.${created.id}`, JSON.stringify(enriched))
    await navigateTo(`/orders/${created.id}/confirmation`)
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
      onSelectImage,
      onSelectVariantByKey,
      onUpdateQuantity,
      onAddToCart,
      onSubmitLead
    }"
  />
</template>
