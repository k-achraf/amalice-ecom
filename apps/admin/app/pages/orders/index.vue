<script setup lang="ts">
import type { OrderState, OrderListResponse } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

useHead({ title: 'Orders' })

const route = useRoute()
const router = useRouter()

const stateOptions = [
  { label: 'All states', value: 'all' },
  ...(['PendingOTP', 'Confirmed', 'Packed', 'HandedToCourier', 'OutForDelivery', 'Delivered', 'CashCollected', 'Reconciled', 'Cancelled', 'DeliveryFailed', 'ReturnedToOrigin', 'Settled'] as OrderState[]).map((s) => ({ label: s, value: s }))
]

const search = ref((route.query.search as string) ?? '')
const stateFilter = ref((route.query.state as string) ?? 'all')

const { data, pending, refresh } = await useAdminFetch<OrderListResponse>('/admin/orders', { key: 'admin-orders' })

// useAdminFetch is keyed without reactive query (its option surface is narrow
// by design). After filter changes we re-fetch manually via the api client.
const api = useAdminApi()
async function loadWithFilters() {
  const q: Record<string, string> = { page: String(route.query.page ?? 1), pageSize: '20' }
  if (stateFilter.value !== 'all') q.state = route.query.state as string
  if (route.query.search) q.search = route.query.search as string
  data.value = await api<OrderListResponse>('/admin/orders', { query: q })
}

function applyFilters() {
  router.push({ query: { ...route.query, search: search.value || undefined, state: stateFilter.value !== 'all' ? stateFilter.value : undefined, page: 1 } }).then(() => loadWithFilters())
}

const totalPages = computed(() => (data.value ? Math.ceil(data.value.total / data.value.pageSize) : 1))
const currentPage = computed(() => Number(route.query.page ?? 1))

// Inline state transition (ADM-04 bulk-action feel): advance an order to its
// next valid state without opening the detail page. The detail page (ADM-05)
// has the full timeline; this is the quick path ops staff use all day.
const transitioning = ref<string | null>(null)

async function advance(orderId: string, currentState: OrderState) {
  const next = VALID_TRANSITIONS[currentState]?.[0]
  if (!next) return
  transitioning.value = orderId
  try {
    await api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: next } })
    await refresh()
  } catch {
    // The 401 handler bounces to login; other errors surface via the table state on next load.
  } finally {
    transitioning.value = null
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Orders">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="search" placeholder="Order ID, phone, or name…" icon="i-lucide-search" @keydown.enter="applyFilters" />
          <USelect v-model="stateFilter" :items="stateOptions" class="w-44" @update:model-value="applyFilters" />
          <UButton color="neutral" variant="outline" icon="i-lucide-search" @click="applyFilters">Filter</UButton>
        </div>

        <!-- Stripe-style table -->
        <div class="admin-kpi-card overflow-hidden">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Order</th>
                <th class="px-4 py-2.5 text-left">Customer</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">COD</th>
                <th class="px-4 py-2.5 text-left">Date</th>
                <th class="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pending">
                <td colspan="6" class="px-4 py-12 text-center text-muted">Loading…</td>
              </tr>
              <tr v-else-if="!data?.items.length">
                <td colspan="6" class="px-4 py-12 text-center text-muted">No orders match these filters.</td>
              </tr>
              <template v-else>
                <tr v-for="order in data.items" :key="order.id" class="cursor-pointer" @click="navigateTo(`/orders/${order.id}`)">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${order.id}`" class="tabular font-medium text-primary hover:underline" @click.stop>
                      {{ order.id.slice(0, 8) }}
                    </NuxtLink>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-highlighted">{{ order.customer.name ?? '—' }}</div>
                    <div class="tabular text-xs text-muted">{{ order.customer.phone }}</div>
                  </td>
                  <td class="px-4 py-3"><StatusBadge :state="order.state" /></td>
                  <td class="tabular px-4 py-3 text-right font-medium"><PriceDisplay :amount-cents="order.totalCents" /></td>
                  <td class="px-4 py-3 text-muted">{{ fmtDate(order.createdAt) }}</td>
                  <td class="px-4 py-3 text-right" @click.stop>
                    <UButton
                      v-if="VALID_TRANSITIONS[order.state]?.length && order.state !== 'Cancelled'"
                      size="xs"
                      variant="soft"
                      color="primary"
                      :loading="transitioning === order.id"
                      :label="`→ ${VALID_TRANSITIONS[order.state][0]}`"
                      @click="advance(order.id, order.state)"
                    />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-between">
          <p class="text-sm text-muted">{{ data?.total }} orders</p>
          <UPagination v-model:page="currentPage" :total="data?.total ?? 0" :items-per-page="20" @update:page="(p) => router.push({ query: { ...route.query, page: p } })" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
