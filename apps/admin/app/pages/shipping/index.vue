<script setup lang="ts">
import type { OrderListResponse, OrderState } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

// Stage 3 of the order pipeline: a parcel handed off by fulfillment, tracked
// through courier delivery. Courier webhooks drive most of these
// transitions automatically (see the fulfillment module's webhook handler);
// this page is mainly a status queue, with a manual override for when
// courier data is stale or wrong, plus the dev-only mock-webhook driver
// (moved here from fulfillment/index.vue since it simulates courier
// progress, which is shipping's domain now, not fulfillment's).
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Shipping' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: withCourier, refresh: refreshWithCourier } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=HandedToCourier&pageSize=50',
  { key: 'admin-shipping-handed' }
)
const { data: outForDelivery, refresh: refreshOutForDelivery } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=OutForDelivery&pageSize=50',
  { key: 'admin-shipping-out' }
)
const { data: failed, refresh: refreshFailed } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=DeliveryFailed&pageSize=50',
  { key: 'admin-shipping-failed' }
)
const { data: returned, refresh: refreshReturned } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=ReturnedToOrigin&pageSize=50',
  { key: 'admin-shipping-returned' }
)

async function refreshAll() {
  await Promise.all([refreshWithCourier(), refreshOutForDelivery(), refreshFailed(), refreshReturned()])
}

const acting = ref<string | null>(null)
async function transition(orderId: string, to: OrderState) {
  acting.value = `${orderId}:${to}`
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to } }), {
    success: `Order moved to ${to}`,
    errorFallback: 'Could not update the order'
  })
  await refreshAll()
  acting.value = null
}

// Dev-only mock status driver (COU-01 mock). Drives a shipment through the
// status flow to simulate a real courier webhook — not a production route.
const mockRef = ref('')
const mockStatus = ref<'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delivery_failed' | 'returned'>('out_for_delivery')
const mockResult = ref('')
async function sendMockStatus() {
  if (!mockRef.value) return
  const res = await run(
    () => api('/admin/fulfillment/mock-status', {
      method: 'POST',
      body: { trackingReference: mockRef.value, normalizedStatus: mockStatus.value }
    }),
    { success: 'Mock status applied', errorFallback: 'Could not apply the mock status' }
  )
  mockResult.value = res !== undefined ? JSON.stringify(res) : ''
  await refreshAll()
}
</script>

<template>
  <AdsPage title="Shipping" :description="`${(withCourier?.total ?? 0) + (outForDelivery?.total ?? 0) + (failed?.total ?? 0) + (returned?.total ?? 0)} orders · With a courier, out for delivery, or needing attention`">
    <section class="card" aria-label="With courier">
      <div class="card-head"><h2>With courier</h2></div>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th>Status</th><th class="num">Advance</th></tr></thead>
          <tbody>
            <tr v-if="!withCourier?.items.length"><td colspan="6" class="empty">Nothing with a courier yet.</td></tr>
            <tr v-for="o in withCourier?.items" :key="o.id">
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td><AdsOrderStatus :state="o.state" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton v-for="next in VALID_TRANSITIONS[o.state]" :key="next" size="sm" :appearance="next === 'DeliveryFailed' ? 'danger' : 'default'" style="margin-left: 6px" :loading="acting === `${o.id}:${next}`" :label="`→ ${next}`" @click="transition(o.id, next)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" aria-label="Out for delivery">
      <div class="card-head"><h2>Out for delivery</h2></div>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th>Status</th><th class="num">Advance</th></tr></thead>
          <tbody>
            <tr v-if="!outForDelivery?.items.length"><td colspan="6" class="empty">Nothing out for delivery.</td></tr>
            <tr v-for="o in outForDelivery?.items" :key="o.id">
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td><AdsOrderStatus :state="o.state" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton v-for="next in VALID_TRANSITIONS[o.state]" :key="next" size="sm" :appearance="next === 'DeliveryFailed' ? 'danger' : 'default'" style="margin-left: 6px" :loading="acting === `${o.id}:${next}`" :label="`→ ${next}`" @click="transition(o.id, next)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" v-if="failed?.items.length || returned?.items.length" aria-label="Delivery issues">
      <div class="card-head"><h2>Delivery issues</h2></div>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th>Status</th><th class="num">Advance</th></tr></thead>
          <tbody>
            
            <tr v-for="o in [...(failed?.items ?? []), ...(returned?.items ?? [])]" :key="o.id">
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td><AdsOrderStatus :state="o.state" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton v-for="next in VALID_TRANSITIONS[o.state]" :key="next" size="sm" :appearance="next === 'DeliveryFailed' ? 'danger' : 'default'" style="margin-left: 6px" :loading="acting === `${o.id}:${next}`" :label="`→ ${next}`" @click="transition(o.id, next)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Dev-only mock status driver -->
    <section class="card" aria-label="Mock courier status">
      <div class="card-head"><h2>Mock courier status</h2><span class="pill neutral">Dev only</span></div>
      <p class="muted">Simulates courier webhook updates against the MockCourierProvider. Not a production route.</p>
      <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px">
        <AdsField label="Tracking ref"><AdsInput v-model="mockRef" placeholder="FS-DEMO-1001" style="width: 190px" /></AdsField>
        <AdsField label="Status">
          <AdsSelect v-model="mockStatus" :items="['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned']" style="width: 190px" />
        </AdsField>
        <AdsButton appearance="default" @click="sendMockStatus">Send</AdsButton>
      </div>
      <p v-if="mockResult" class="mono muted">{{ mockResult }}</p>
    </section>
  </AdsPage>
</template>

<style scoped>
.note-line { margin-top: 2px; max-width: 240px; font-size: 11px; line-height: 1.3; color: var(--text-2); white-space: pre-wrap; }
</style>
