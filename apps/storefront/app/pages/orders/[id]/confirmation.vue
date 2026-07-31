<script setup lang="ts">
useSeoMeta({ title: 'تم تأكيد الطلب' })

interface ConfirmedOrderItem {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}
interface ConfirmedOrder {
  id: string
  totalCents: number
  state: string
  createdAt: string
  items: ConfirmedOrderItem[]
}

const route = useRoute()
const orderId = route.params.id as string

const order = ref<ConfirmedOrder | null>(null)
const notFound = ref(false)
const metaPixel = useMetaPixel()
const tiktokPixel = useTikTokPixel()

onMounted(() => {
  const raw = sessionStorage.getItem(`amalice.order.${orderId}`)
  if (!raw) {
    notFound.value = true
    return
  }
  try {
    order.value = JSON.parse(raw)
  } catch {
    notFound.value = true
    return
  }
  if (!order.value) return

  // Purchase events (both pixels) — the shared eventId is the order id,
  // matching the id each platform's server-side API call uses by default
  // (see orders.service.ts), so each platform dedupes its browser and
  // server events into one. Guarded by a sessionStorage flag: a refresh of
  // this page must not double-count a purchase that already fired once.
  const dedupeKey = `amalice.order.${orderId}.pixelFired`
  if (!sessionStorage.getItem(dedupeKey)) {
    sessionStorage.setItem(dedupeKey, '1')
    metaPixel.trackEvent(
      'Purchase',
      {
        content_ids: order.value.items.map((i) => i.productId),
        content_type: 'product',
        contents: order.value.items.map((i) => ({ id: i.productId, quantity: i.quantity })),
        value: order.value.totalCents / 100,
        currency: 'DZD'
      },
      orderId
    )
    tiktokPixel.trackEvent(
      'CompletePayment',
      {
        contents: order.value.items.map((i) => ({ content_id: i.productId, quantity: i.quantity, price: i.unitPriceCents / 100 })),
        value: order.value.totalCents / 100,
        currency: 'DZD'
      },
      orderId
    )
  }
})

// Placeholder window until the courier track lands (COU track) — COD orders
// in this seed data ship domestically, so a flat estimate is honest for now
// rather than a fabricated per-order calculation with nothing behind it.
const deliveryWindow = '3 إلى 5 أيام عمل'
</script>

<template>
  <ClientOnly>
    <TemplatePage name="Confirmation" :page-props="{ order, notFound, deliveryWindow }" />
  </ClientOnly>
</template>
