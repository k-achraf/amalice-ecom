<script setup lang="ts">
import type { OrderState } from '@amalice/shared'
import type { OrderListResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Fulfillment' })

const api = useAdminApi()
// Orders ready to dispatch (Packed) + in transit (HandedToCourier, OutForDelivery).
const { data, pending, refresh } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=Packed&pageSize=50',
  { key: 'admin-fulfillment-packed' }
)
const { data: transit } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=HandedToCourier&pageSize=50',
  { key: 'admin-fulfillment-transit' }
)

const dispatching = ref<string | null>(null)
async function dispatch(orderId: string) {
  dispatching.value = orderId
  try {
    await api(`/admin/fulfillment/orders/${orderId}/dispatch`, { method: 'POST' })
    await refresh()
  } finally {
    dispatching.value = null
  }
}

// Dev-only mock status driver (COU-01 mock). Drives a shipment through the
// status flow to simulate a real courier webhook — not a production route.
const mockRef = ref('')
const mockStatus = ref<'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delivery_failed' | 'returned'>('out_for_delivery')
const mockResult = ref('')
async function sendMockStatus() {
  if (!mockRef.value) return
  try {
    const res = await api('/admin/fulfillment/mock-status', {
      method: 'POST',
      body: { trackingReference: mockRef.value, normalizedStatus: mockStatus.value }
    })
    mockResult.value = JSON.stringify(res)
    await refresh()
  } catch (e) {
    mockResult.value = String(e)
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Fulfillment & Dispatch">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-8">
        <!-- Ready to dispatch -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Ready to dispatch (Packed)</h2>
          <div class="admin-kpi-card overflow-hidden">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-4 py-2.5 text-left">Order</th>
                  <th class="px-4 py-2.5 text-left">Customer</th>
                  <th class="px-4 py-2.5 text-right">COD</th>
                  <th class="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pending"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-else-if="!data?.items.length"><td colspan="4" class="px-4 py-12 text-center text-muted">No orders ready to dispatch.</td></tr>
                <tr v-for="o in data?.items" :key="o.id">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  </td>
                  <td class="px-4 py-3">{{ o.customer.name ?? '—' }}</td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="o.totalCents" /></td>
                  <td class="px-4 py-3 text-right">
                    <UButton icon="i-lucide-truck" size="xs" color="primary" :loading="dispatching === o.id" label="Dispatch" @click="dispatch(o.id)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- In transit -->
        <section v-if="transit?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">With courier</h2>
          <div class="admin-kpi-card overflow-hidden">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr><th class="px-4 py-2.5 text-left">Order</th><th class="px-4 py-2.5 text-left">Customer</th><th class="px-4 py-2.5 text-left">Status</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in transit.items" :key="o.id">
                  <td class="px-4 py-3"><NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink></td>
                  <td class="px-4 py-3">{{ o.customer.name ?? '—' }}</td>
                  <td class="px-4 py-3"><StatusBadge :state="o.state" /></td>
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
