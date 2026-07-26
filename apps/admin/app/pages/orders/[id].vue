<script setup lang="ts">
import type { OrderState } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

const route = useRoute()
const id = route.params.id as string
useHead({ title: `Order ${id.slice(0, 8)}` })

interface AdminOrderDetail {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string | null; phone: string }
  address: { line1: string; line2: string | null; city: string; region: string; postalCode: string; country: string }
  items: { id: string; productId: string; quantity: number; unitPriceCents: number; product: { name: string; slug: string; imageUrl: string | null } }[]
  shipment: { courier: { name: string }; trackingReference: string | null; courierStatus: string | null } | null
  cashReconciliation: { expectedCents: number; collectedCents: number | null } | null
}

const api = useAdminApi()
const { data: order, pending, error, refresh } = await useAdminFetch<AdminOrderDetail>(`/admin/orders/${id}`, { key: `admin-order-${id}` })

const transitioning = ref<OrderState | null>(null)

async function transition(to: OrderState) {
  transitioning.value = to
  try {
    await api(`/admin/orders/${id}/transition`, { method: 'POST', body: { to } })
    await refresh()
  } catch {
    // 401 → login bounce (handled); 400 illegal transition surfaces on next load
  } finally {
    transitioning.value = null
  }
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="`Order ${id.slice(0, 8)}`">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/orders" />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <EmptyState v-else-if="error" icon="i-lucide-package-x" title="Order not found" />
      <div v-else-if="order" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Main column: items + status actions -->
        <div class="space-y-6 lg:col-span-2">
          <div class="admin-kpi-card p-5">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">Total due (COD)</p>
                <PriceDisplay :amount-cents="order.totalCents" class="text-2xl font-semibold" />
              </div>
              <StatusBadge :state="order.state" />
            </div>

            <h3 class="mb-2 text-sm font-medium text-muted">Items</h3>
            <ul class="divide-y divide-[var(--color-admin-border)]">
              <li v-for="item in order.items" :key="item.id" class="flex items-center justify-between py-3">
                <div>
                  <NuxtLink :to="`/inventory`" class="font-medium hover:underline">{{ item.product.name }}</NuxtLink>
                  <p class="text-xs text-muted">Qty {{ item.quantity }} × <PriceDisplay :amount-cents="item.unitPriceCents" /></p>
                </div>
                <PriceDisplay :amount-cents="item.unitPriceCents * item.quantity" class="tabular font-medium" />
              </li>
            </ul>
          </div>

          <!-- Manual transition: the UI only offers valid next states, making an
               illegal transition impossible to submit (server re-validates). -->
          <div v-if="VALID_TRANSITIONS[order.state]?.length" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Advance status</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="next in VALID_TRANSITIONS[order.state]"
                :key="next"
                :color="next === 'Cancelled' ? 'error' : 'primary'"
                :variant="next === 'Cancelled' ? 'outline' : 'solid'"
                :loading="transitioning === next"
                :label="next"
                size="sm"
                @click="transition(next)"
              />
            </div>
            <p class="mt-3 text-xs text-muted">Only valid transitions are shown. The server re-validates each one.</p>
          </div>

          <!-- Shipment / fulfillment -->
          <div v-if="order.shipment" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Shipment</h3>
            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div><dt class="text-muted">Courier</dt><dd>{{ order.shipment.courier.name }}</dd></div>
              <div><dt class="text-muted">Tracking ref</dt><dd class="tabular">{{ order.shipment.trackingReference ?? '—' }}</dd></div>
              <div><dt class="text-muted">Courier status</dt><dd>{{ order.shipment.courierStatus ?? '—' }}</dd></div>
            </dl>
            <UButton
              v-if="order.state === 'Packed'"
              class="mt-4"
              icon="i-lucide-truck"
              size="sm"
              label="Dispatch to courier"
              @click="api(`/admin/fulfillment/orders/${id}/dispatch`, { method: 'POST' }).then(() => refresh())"
            />
          </div>
        </div>

        <!-- Side column: customer + address -->
        <div class="space-y-6">
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Customer</h3>
            <NuxtLink :to="`/customers/${order.customer.id}`" class="block font-medium hover:underline">
              {{ order.customer.name ?? '—' }}
            </NuxtLink>
            <p class="tabular text-sm text-muted">{{ order.customer.phone }}</p>
          </div>

          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Delivery address</h3>
            <address class="text-sm not-italic leading-relaxed text-muted">
              {{ order.address.line1 }}<br />
              <span v-if="order.address.line2">{{ order.address.line2 }}<br /></span>
              {{ order.address.city }}, {{ order.address.region }} {{ order.address.postalCode }}<br />
              {{ order.address.country }}
            </address>
          </div>

          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Timeline</h3>
            <p class="text-sm text-muted">Created {{ fmtDateTime(order.createdAt) }}</p>
            <p class="text-sm text-muted">Last update {{ fmtDateTime(order.updatedAt) }}</p>
            <p v-if="order.cashReconciliation" class="mt-3 text-sm text-success">
              Reconciled — collected <PriceDisplay :amount-cents="order.cashReconciliation.collectedCents ?? 0" />
            </p>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
