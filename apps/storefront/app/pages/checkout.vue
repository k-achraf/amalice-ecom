<script setup lang="ts">
import { CheckoutSchema } from '@amalice/shared'

// If displayCart is false (lead-form mode), there is no checkout page — redirect.
const settings = useStoreSettings()
if (!settings.value.displayCart) {
  await navigateTo('/')
}

// LOGIC ONLY — the 2-step COD flow stays here (address, review). Presentation
// via <TemplatePage name="Checkout">. Order placement is single-sourced;
// templates can't drift checkout behavior. No OTP step: the order lands in
// PendingCallCenter directly and a call-center agent confirms it by phone.
useSeoMeta({ title: 'Checkout' })

const cart = useCartStore()
const apiClient = useApiClient()
const router = useRouter()
const metaPixel = useMetaPixel()
const tiktokPixel = useTikTokPixel()

// InitiateCheckout (both pixels) — fires once, when the checkout page is
// actually reached with items in the cart (not on every render/step change).
if (import.meta.client && cart.items.length > 0) {
  metaPixel.trackEvent('InitiateCheckout', {
    content_ids: cart.items.map((i) => i.productId),
    content_type: 'product',
    contents: cart.items.map((i) => ({ id: i.productId, quantity: i.quantity })),
    value: cart.totalCents / 100,
    currency: 'DZD',
    num_items: cart.itemCount
  })
  tiktokPixel.trackEvent('InitiateCheckout', {
    contents: cart.items.map((i) => ({ content_id: i.productId, quantity: i.quantity, price: i.priceCents / 100 })),
    value: cart.totalCents / 100,
    currency: 'DZD'
  })
}

type Step = 'address' | 'review'
const step = ref<Step>('address')
const stepItems = [
  { value: 'address', title: 'Address', icon: 'i-lucide-map-pin' },
  { value: 'review', title: 'Review', icon: 'i-lucide-clipboard-list' }
]

const AddressStepSchema = CheckoutSchema.omit({ items: true })
const form = reactive({
  phone: '',
  name: '',
  wilayaId: '',
  shippingType: '',
  shippingPriceCents: 0,
  address: { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' }
})

const totalCents = computed(() => cart.totalCents + form.shippingPriceCents)

const addressError = ref<string | null>(null)
function onAddressSubmit() {
  if (!form.wilayaId || !form.shippingType) {
    addressError.value = 'Please select a shipping method.'
    return
  }
  addressError.value = null
  step.value = 'review'
}

const placing = ref(false)
const placeError = ref<string | null>(null)

interface ConfirmedOrderItem {
  productId: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}
interface PlacedOrder {
  id: string
  totalCents: number
  state: string
  createdAt: string
  items: ConfirmedOrderItem[]
}

async function placeOrder() {
  placing.value = true
  placeError.value = null
  try {
    const created = await apiClient<PlacedOrder>('/orders', {
      method: 'POST',
      body: {
        phone: form.phone,
        name: form.name || undefined,
        address: { ...form.address, line2: form.address.line2 || undefined },
        wilayaId: form.wilayaId,
        shippingType: form.shippingType,
        items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: i.quantity, offerId: i.offerId ?? undefined })),
        // Pixel match-quality context — see CheckoutTrackingSchema. No
        // eventId here: the server defaults each platform's server-side
        // purchase event id to the order id, and the confirmation page's
        // browser pixel calls use that same order id, so they dedupe
        // without the client needing to invent and thread an id through.
        tracking: { ...metaPixel.getFbCookies(), ...tiktokPixel.getTtCookie() }
      }
    })
    const nameByProductId = new Map(cart.items.map((i) => [i.productId, i.name]))
    const enriched = {
      ...created,
      items: created.items.map((i) => ({ ...i, name: nameByProductId.get(i.productId) ?? 'Item' }))
    }
    sessionStorage.setItem(`amalice.order.${created.id}`, JSON.stringify(enriched))
    // Upsells system — the post-checkout upsell page needs the phone to
    // authorize its GET/accept calls (same shared-secret model as order
    // tracking). Stashed alongside the order rather than passed as a URL
    // query param so it doesn't end up in browser history/referrers.
    sessionStorage.setItem(`amalice.order.${created.id}.phone`, form.phone)
    cart.clear()
    await router.push(`/orders/${created.id}/upsell`)
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    placeError.value = data?.message ?? 'Something went wrong. Please try again.'
  } finally {
    placing.value = false
  }
}

function onBack() {
  step.value = 'address'
}
</script>

<template>
  <TemplatePage
    name="Checkout"
    :page-props="{
      cart,
      step,
      stepItems,
      form,
      addressSchema: AddressStepSchema,
      addressError,
      totalCents,
      placing: placing ?? false,
      placeError,
      onAddressSubmit,
      onPlaceOrder: placeOrder,
      onBack
    }"
  />
</template>
