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
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Shipping">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-8">
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">With courier</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr><th class="px-4 py-2.5 text-left">Order</th><th class="px-4 py-2.5 text-left">Products</th><th class="px-4 py-2.5 text-left">Customer</th><th class="px-4 py-2.5 text-left">Status</th><th class="px-4 py-2.5 text-right">Advance</th></tr>
              </thead>
              <tbody>
                <tr v-if="!withCourier?.items.length"><td colspan="5" class="px-4 py-12 text-center text-muted">Nothing with a courier yet.</td></tr>
                <tr v-for="o in withCourier?.items" :key="o.id">
                  <td class="px-4 py-3"><NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink></td>
                  <td class="px-4 py-3"><OrderLineItemsInline :items="o.items" compact class="max-w-64" /></td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5">
                      {{ o.customer.name ?? '—' }}
                      <UIcon v-if="o.notes" name="i-lucide-sticky-note" class="size-3.5 shrink-0 text-muted" :title="o.notes" />
                    </span>
                  </td>
                  <td class="px-4 py-3"><StatusBadge :state="o.state" /></td>
                  <td class="px-4 py-3 text-right">
                    <UButton v-for="next in VALID_TRANSITIONS[o.state]" :key="next" size="xs" variant="soft" class="ml-2" :loading="acting === `${o.id}:${next}`" :label="`→ ${next}`" @click="transition(o.id, next)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Out for delivery</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr><th class="px-4 py-2.5 text-left">Order</th><th class="px-4 py-2.5 text-left">Products</th><th class="px-4 py-2.5 text-left">Customer</th><th class="px-4 py-2.5 text-left">Status</th><th class="px-4 py-2.5 text-right">Advance</th></tr>
              </thead>
              <tbody>
                <tr v-if="!outForDelivery?.items.length"><td colspan="5" class="px-4 py-12 text-center text-muted">Nothing out for delivery.</td></tr>
                <tr v-for="o in outForDelivery?.items" :key="o.id">
                  <td class="px-4 py-3"><NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink></td>
                  <td class="px-4 py-3"><OrderLineItemsInline :items="o.items" compact class="max-w-64" /></td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5">
                      {{ o.customer.name ?? '—' }}
                      <UIcon v-if="o.notes" name="i-lucide-sticky-note" class="size-3.5 shrink-0 text-muted" :title="o.notes" />
                    </span>
                  </td>
                  <td class="px-4 py-3"><StatusBadge :state="o.state" /></td>
                  <td class="px-4 py-3 text-right">
                    <UButton
                      v-for="next in VALID_TRANSITIONS[o.state]"
                      :key="next"
                      size="xs"
                      variant="soft"
                      :color="next === 'DeliveryFailed' ? 'error' : 'primary'"
                      class="ml-2"
                      :loading="acting === `${o.id}:${next}`"
                      :label="`→ ${next}`"
                      @click="transition(o.id, next)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="failed?.items.length || returned?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">Delivery issues</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr><th class="px-4 py-2.5 text-left">Order</th><th class="px-4 py-2.5 text-left">Products</th><th class="px-4 py-2.5 text-left">Customer</th><th class="px-4 py-2.5 text-left">Status</th><th class="px-4 py-2.5 text-right">Advance</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in [...(failed?.items ?? []), ...(returned?.items ?? [])]" :key="o.id">
                  <td class="px-4 py-3"><NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink></td>
                  <td class="px-4 py-3"><OrderLineItemsInline :items="o.items" compact class="max-w-64" /></td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center gap-1.5">
                      {{ o.customer.name ?? '—' }}
                      <UIcon v-if="o.notes" name="i-lucide-sticky-note" class="size-3.5 shrink-0 text-muted" :title="o.notes" />
                    </span>
                  </td>
                  <td class="px-4 py-3"><StatusBadge :state="o.state" /></td>
                  <td class="px-4 py-3 text-right">
                    <UButton v-for="next in VALID_TRANSITIONS[o.state]" :key="next" size="xs" variant="soft" class="ml-2" :loading="acting === `${o.id}:${next}`" :label="`→ ${next}`" @click="transition(o.id, next)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Dev-only mock status driver -->
        <section class="admin-kpi-card p-5">
          <h3 class="mb-1 text-sm font-medium text-muted">Mock courier status (dev only)</h3>
          <p class="mb-3 text-xs text-muted">Simulates courier webhook updates against the MockCourierProvider. Not a production route.</p>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Tracking ref"><UInput v-model="mockRef" placeholder="FS-DEMO-1001" class="tabular w-44" /></UFormField>
            <UFormField label="Status">
              <USelect
                v-model="mockStatus"
                :items="['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned']"
                class="w-44"
              />
            </UFormField>
            <UButton size="sm" label="Send" @click="sendMockStatus" />
          </div>
          <p v-if="mockResult" class="mt-3 text-xs tabular text-muted">{{ mockResult }}</p>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
