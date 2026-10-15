<script setup lang="ts">

import { CALL_CENTER_STATE_TO_ORDER_STATE, SHIPPING_STATE_TO_ORDER_STATE, type CallCenterState, type OrderState, type ShippingState } from '@amalice/shared'

interface CustomerDetail {
  id: string
  name: string | null
  phone: string
  addresses: { id: string; line1: string; city: string; region: string; postalCode: string }[]
  orders: { id: string; state: OrderState; callCenterState: CallCenterState; shippingState: ShippingState | null; totalCents: number; createdAt: string }[]
}

const route = useRoute()
const id = route.params.id as string
useHead({ title: 'Customer' })
const api = useAdminApi()
const { run } = useApiAction()
const { isSuperAdmin, confirmDelete } = useDangerDelete()

const { data: customer, pending, error } = await useAdminFetch<CustomerDetail>(`/admin/customers/${id}`, { key: `admin-customer-${id}` })

// Permanent delete (SuperAdmin). A customer with orders is deleted together with them.
async function deleteCustomer() {
  if (!customer.value) return
  const count = customer.value.orders?.length ?? 0
  const label = customer.value.name ?? customer.value.phone
  if (!confirmDelete(`Permanently delete ${label}${count ? ` AND their ${count} order${count === 1 ? '' : 's'} (items, shipments, reconciliation)` : ''}?`)) return
  const res = await run(() => api(`/admin/customers/${id}`, { method: 'DELETE', query: count ? { withOrders: '1' } : {} }), { success: 'Customer deleted', errorFallback: 'Could not delete the customer' })
  if (res !== undefined) await navigateTo('/customers')
}
</script>

<template>
  <AdsPage :title="customer?.name ?? customer?.phone ?? 'Customer'" :description="customer?.name ? customer.phone : undefined">
    <template v-if="isSuperAdmin && customer" #actions>
      <button class="btn btn-danger" type="button" @click="deleteCustomer"><AdsIcon name="i-lucide-trash-2" />Delete</button>
    </template>
    <template #breadcrumb>
      <NuxtLink to="/customers">Customers</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ customer?.name ?? customer?.phone ?? 'Customer' }}</span>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <AdsEmptyState v-else-if="error" icon="i-lucide-user-x" title="Customer not found" />
    <div v-else-if="customer" class="split">
      <section class="card flush" aria-labelledby="oh-h">
        <div class="card-head"><h2 id="oh-h">Order history</h2></div>
        <div v-if="customer.orders?.length" class="table-wrap">
          <table style="min-width: 520px">
            <thead><tr><th style="padding-left: 20px">Order</th><th>Status</th><th class="num" style="padding-right: 20px">Total</th></tr></thead>
            <tbody>
              <tr v-for="o in customer.orders" :key="o.id" class="clickable" @click="navigateTo(`/orders/${o.id}`)">
                <td style="padding-left: 20px"><NuxtLink class="link-cell" :to="`/orders/${o.id}`">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
                <td>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px">
                    <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[o.callCenterState]" />
                    <AdsOrderStatus v-if="o.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[o.shippingState]" />
                  </div>
                </td>
                <td class="num strong" style="padding-right: 20px"><AdsPrice :amount-cents="o.totalCents" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty">No orders yet.</p>
      </section>

      <div class="stack">
        <section class="card" aria-labelledby="pf-h">
          <div class="card-head"><h2 id="pf-h">Profile</h2></div>
          <div style="display: flex; align-items: center; gap: 14px">
            <span class="initials lg">{{ (customer.name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() }}</span>
            <div class="grow"><b style="font-weight: 600">{{ customer.name ?? '—' }}</b><span class="muted" style="display: block">{{ customer.phone }}</span></div>
          </div>
          <a class="btn" :href="`tel:${customer.phone}`"><AdsIcon name="i-lucide-phone" />Call {{ customer.phone }}</a>
          <p class="muted">Risk score: not yet available (RSK-01)</p>
        </section>
        <section v-if="customer.addresses?.length" class="card" aria-labelledby="ad-h">
          <div class="card-head"><h2 id="ad-h">Addresses</h2></div>
          <dl v-for="a in customer.addresses" :key="a.id" class="details">
            <dt>Address</dt><dd>{{ a.line1 }}</dd><dt>Commune</dt><dd>{{ a.city }}</dd><dt>Wilaya</dt><dd>{{ a.region }}</dd>
          </dl>
        </section>
      </div>
    </div>
  </AdsPage>
</template>
