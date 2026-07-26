<script setup lang="ts">
useSeoMeta({ title: 'Order confirmed' })

interface ConfirmedOrderItem {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
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
  }
})

// Placeholder window until the courier track lands (COU track) — COD orders
// in this seed data ship domestically, so a flat estimate is honest for now
// rather than a fabricated per-order calculation with nothing behind it.
const deliveryWindow = '3–5 business days'
</script>

<template>
  <ClientOnly>
    <main class="mx-auto max-w-2xl space-y-6 p-6">
      <EmptyState
        v-if="notFound"
        icon="i-lucide-search-x"
        title="We can't find that confirmation"
        description="This page only works right after checkout. If you already left it, use order tracking with your phone number instead."
      >
        <UButton to="/" variant="outline" color="neutral">Continue shopping</UButton>
      </EmptyState>

      <template v-else-if="order">
        <div class="flex flex-col items-center gap-2 py-6 text-center">
          <UIcon name="i-lucide-check-circle" class="size-12 text-success" />
          <h1 class="text-2xl font-semibold">Order confirmed</h1>
          <p class="text-sm text-neutral-500">
            Order ID
            <span class="tabular font-medium text-highlighted">{{ order.id }}</span>
          </p>
        </div>

        <div class="space-y-2 rounded-md border border-default p-4">
          <h2 class="font-medium text-highlighted">Items</h2>
          <ul class="divide-y divide-default">
            <li
              v-for="item in order.items"
              :key="item.productId"
              class="flex justify-between py-2 text-sm"
            >
              <span>{{ item.name }} × {{ item.quantity }}</span>
              <PriceDisplay :amount-cents="item.unitPriceCents * item.quantity" />
            </li>
          </ul>
          <div class="flex items-center justify-between border-t border-default pt-3">
            <span class="font-medium">Cash due on delivery</span>
            <PriceDisplay :amount-cents="order.totalCents" class="text-lg font-semibold" />
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-md border border-default p-4 text-sm">
          <UIcon name="i-lucide-truck" class="size-5 shrink-0 text-neutral-500" />
          <span
            >Estimated delivery: {{ deliveryWindow }}. Keep your order ID handy if you contact
            support.</span
          >
        </div>

        <UButton to="/" block variant="outline" color="neutral">Continue shopping</UButton>
      </template>
    </main>
  </ClientOnly>
</template>
