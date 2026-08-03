<script setup lang="ts">
import type { OrderListResponse } from '@amalice/shared'

// Stage 2 of the order pipeline: warehouse picks/packs a call-center-confirmed
// order, then hands it to a courier — which is where fulfillment's job ends
// and shipping's begins (see shipping/index.vue for HandedToCourier onward).
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Fulfillment' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: confirmed, pending: pendingConfirmed, refresh: refreshConfirmed } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=Confirmed&pageSize=50',
  { key: 'admin-fulfillment-confirmed' }
)
const { data: packed, pending: pendingPacked, refresh: refreshPacked } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=Packed&pageSize=50',
  { key: 'admin-fulfillment-packed' }
)
// On hold — a confirmed order that can't be packed as-is (e.g. stock ran
// out between confirm and pack) without cancelling it outright. See
// OrderState's Prisma comment.
const { data: onHold, pending: pendingOnHold, refresh: refreshOnHold } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=OnHold&pageSize=50',
  { key: 'admin-fulfillment-onhold' }
)

const acting = ref<string | null>(null)

async function markPacked(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'Packed' } }), {
    success: 'Order marked as packed',
    errorFallback: 'Could not mark the order as packed'
  })
  await Promise.all([refreshConfirmed(), refreshPacked()])
  acting.value = null
}

async function putOnHold(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'OnHold' } }), {
    success: 'Order put on hold',
    errorFallback: 'Could not put the order on hold'
  })
  await Promise.all([refreshConfirmed(), refreshOnHold()])
  acting.value = null
}

async function resumeFromHold(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'Confirmed' } }), {
    success: 'Order resumed',
    errorFallback: 'Could not resume the order'
  })
  await Promise.all([refreshConfirmed(), refreshOnHold()])
  acting.value = null
}

async function cancelOnHold(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'Cancelled' } }), {
    success: 'Order cancelled',
    errorFallback: 'Could not cancel the order'
  })
  await refreshOnHold()
  acting.value = null
}

async function dispatch(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/fulfillment/orders/${orderId}/dispatch`, { method: 'POST' }), {
    success: 'Order dispatched to courier',
    errorFallback: 'Could not dispatch the order'
  })
  await refreshPacked()
  acting.value = null
}

// Manual (in-house) delivery — same "Packed" queue, no shipping company API
// call. Both dispatch actions require the order to already be assigned
// (see orders/[id].vue's assign-company/assign-manual controls); an
// unassigned order shows a link to the detail page to assign it instead.
async function dispatchManual(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/fulfillment/orders/${orderId}/dispatch-manual`, { method: 'POST' }), {
    success: 'Handed to delivery driver',
    errorFallback: 'Could not dispatch the order'
  })
  await refreshPacked()
  acting.value = null
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Fulfillment">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-8">
        <!-- Awaiting packing -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Awaiting packing (Confirmed)</h2>
          <div class="admin-table-wrap">
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
                <tr v-if="pendingConfirmed"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-else-if="!confirmed?.items.length"><td colspan="4" class="px-4 py-12 text-center text-muted">Nothing waiting to be packed.</td></tr>
                <tr v-for="o in confirmed?.items" :key="o.id">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  </td>
                  <td class="px-4 py-3">{{ o.customer.name ?? '—' }}</td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="o.totalCents" /></td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-2">
                      <UButton icon="i-lucide-pause-circle" size="xs" color="neutral" variant="outline" :loading="acting === o.id" label="Hold" @click="putOnHold(o.id)" />
                      <UButton icon="i-lucide-package-check" size="xs" color="primary" :loading="acting === o.id" label="Mark packed" @click="markPacked(o.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- On hold -->
        <section v-if="onHold?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">On hold</h2>
          <div class="admin-table-wrap">
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
                <tr v-if="pendingOnHold"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-for="o in onHold?.items" :key="o.id">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  </td>
                  <td class="px-4 py-3">{{ o.customer.name ?? '—' }}</td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="o.totalCents" /></td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex justify-end gap-2">
                      <UButton icon="i-lucide-play-circle" size="xs" color="primary" :loading="acting === o.id" label="Resume" @click="resumeFromHold(o.id)" />
                      <UButton icon="i-lucide-x" size="xs" color="error" variant="outline" :loading="acting === o.id" label="Cancel" @click="cancelOnHold(o.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Ready to dispatch -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Ready to dispatch (Packed)</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-4 py-2.5 text-left">Order</th>
                  <th class="px-4 py-2.5 text-left">Customer</th>
                  <th class="px-4 py-2.5 text-left">Shipping</th>
                  <th class="px-4 py-2.5 text-right">COD</th>
                  <th class="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pendingPacked"><td colspan="5" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-else-if="!packed?.items.length"><td colspan="5" class="px-4 py-12 text-center text-muted">No orders ready to dispatch.</td></tr>
                <tr v-for="o in packed?.items" :key="o.id">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${o.id}`" class="tabular text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  </td>
                  <td class="px-4 py-3">{{ o.customer.name ?? '—' }}</td>
                  <td class="px-4 py-3">
                    <UBadge v-if="o.fulfillmentMethod === 'Unassigned'" color="warning" variant="subtle">Unassigned</UBadge>
                    <UBadge v-else-if="o.fulfillmentMethod === 'Manual'" color="neutral" variant="subtle">Manual</UBadge>
                    <UBadge v-else color="primary" variant="subtle">{{ o.shippingCompanyName }}</UBadge>
                  </td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="o.totalCents" /></td>
                  <td class="px-4 py-3 text-right">
                    <UButton
                      v-if="o.fulfillmentMethod === 'Unassigned'"
                      icon="i-lucide-link"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      label="Assign"
                      :to="`/orders/${o.id}`"
                    />
                    <UButton
                      v-else-if="o.fulfillmentMethod === 'Manual'"
                      icon="i-lucide-truck"
                      size="xs"
                      color="primary"
                      :loading="acting === o.id"
                      label="Hand to driver"
                      @click="dispatchManual(o.id)"
                    />
                    <UButton
                      v-else
                      icon="i-lucide-truck"
                      size="xs"
                      color="primary"
                      :loading="acting === o.id"
                      label="Dispatch"
                      @click="dispatch(o.id)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
