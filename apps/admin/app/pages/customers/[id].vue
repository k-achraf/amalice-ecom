<script setup lang="ts">
import type { OrderState } from '@amalice/shared'

interface CustomerDetail {
  id: string
  name: string | null
  phone: string
  addresses: { id: string; line1: string; city: string; region: string; postalCode: string }[]
  orders: { id: string; state: OrderState; totalCents: number; createdAt: string }[]
}

const route = useRoute()
const id = route.params.id as string
useHead({ title: 'Customer' })

const { data: customer, pending, error } = await useAdminFetch<CustomerDetail>(`/admin/customers/${id}`, { key: `admin-customer-${id}` })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="customer?.name ?? customer?.phone ?? 'Customer'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/customers" />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <EmptyState v-else-if="error" icon="i-lucide-user-x" title="Customer not found" />
      <div v-else-if="customer" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Order history</h3>
            <table class="admin-table w-full text-sm" v-if="customer.orders?.length">
              <thead>
                <tr><th class="px-2 py-2 text-left">Order</th><th class="px-2 py-2 text-left">Status</th><th class="px-2 py-2 text-right">Total</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in customer.orders" :key="o.id" class="cursor-pointer" @click="navigateTo(`/orders/${o.id}`)">
                  <td class="px-2 py-2 tabular text-primary">{{ o.id.slice(0, 8) }}</td>
                  <td class="px-2 py-2"><StatusBadge :state="o.state" /></td>
                  <td class="tabular px-2 py-2 text-right"><PriceDisplay :amount-cents="o.totalCents" /></td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-8 text-center text-muted">No orders yet.</p>
          </div>
        </div>
        <div class="space-y-6">
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Profile</h3>
            <p class="font-medium text-highlighted">{{ customer.name ?? '—' }}</p>
            <p class="tabular text-sm text-muted">{{ customer.phone }}</p>
            <p class="mt-3 text-xs text-muted">Risk score: <span class="text-muted">not yet available (RSK-01)</span></p>
          </div>
          <div v-if="customer.addresses?.length" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Addresses</h3>
            <address v-for="a in customer.addresses" :key="a.id" class="mb-3 text-sm not-italic leading-relaxed text-muted">
              {{ a.line1 }}, {{ a.city }}, {{ a.region }} {{ a.postalCode }}
            </address>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
