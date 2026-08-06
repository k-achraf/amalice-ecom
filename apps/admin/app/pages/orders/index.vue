<script setup lang="ts">
import type { OrderState, OrderListResponse } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

useHead({ title: 'Orders' })

const route = useRoute()
const router = useRouter()

const stateOptions = [
  { label: 'All states', value: 'all' },
  ...([
    'PendingCallCenter',
    'CallCenterNoAnswer',
    'WrongNumber',
    'Postponed',
    'Confirmed',
    'OnHold',
    'Packed',
    'HandedToCourier',
    'OutForDelivery',
    'Delivered',
    'CashCollected',
    'Reconciled',
    'Cancelled',
    'DeliveryFailed',
    'ReturnedToOrigin',
    'Settled'
  ] as OrderState[]).map((s) => ({ label: s, value: s }))
]

const search = ref((route.query.search as string) ?? '')
const stateFilter = ref((route.query.state as string) ?? 'all')

const { data, pending } = await useAdminFetch<OrderListResponse>('/admin/orders', {
  key: 'admin-orders',
  query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '20' }
})

// useAdminFetch is keyed without reactive query (its option surface is narrow
// by design). After filter/page/pageSize changes we re-fetch manually via
// the api client — this IS the server-side pagination: every page or
// page-size change hits the API again with the new page/pageSize, never
// slices an already-fetched array client-side.
const api = useAdminApi()
const { run } = useApiAction()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))

async function loadWithFilters() {
  const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  if (stateFilter.value !== 'all') q.state = route.query.state as string
  if (route.query.search) q.search = route.query.search as string
  data.value = await api<OrderListResponse>('/admin/orders', { query: q })
}

function applyFilters() {
  router.push({ query: { ...route.query, search: search.value || undefined, state: stateFilter.value !== 'all' ? stateFilter.value : undefined, page: 1 } }).then(() => loadWithFilters())
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await loadWithFilters()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await loadWithFilters()
}

// Inline state transition (ADM-04 bulk-action feel): advance an order to its
// next valid state without opening the detail page. The detail page (ADM-05)
// has the full timeline; this is the quick path ops staff use all day.
const transitioning = ref<string | null>(null)

async function advance(orderId: string, currentState: OrderState) {
  const next = VALID_TRANSITIONS[currentState]?.[0]
  if (!next) return
  transitioning.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: next } }), {
    success: `Order moved to ${next}`,
    errorFallback: 'Could not update the order'
  })
  await loadWithFilters()
  transitioning.value = null
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
        <div class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Order</th>
                <th class="px-4 py-2.5 text-left">Products</th>
                <th class="px-4 py-2.5 text-left">Customer</th>
                <th class="px-4 py-2.5 text-left">Wilaya</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">COD</th>
                <th class="px-4 py-2.5 text-left">Date</th>
                <th class="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pending">
                <td colspan="8" class="px-4 py-12 text-center text-muted">Loading…</td>
              </tr>
              <tr v-else-if="!data?.items.length">
                <td colspan="8" class="px-4 py-12 text-center text-muted">No orders match these filters.</td>
              </tr>
              <template v-else>
                <tr v-for="order in data.items" :key="order.id" class="cursor-pointer" @click="navigateTo(`/orders/${order.id}`)">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/orders/${order.id}`" class="tabular font-medium text-primary hover:underline" @click.stop>
                      {{ order.id.slice(0, 8) }}
                    </NuxtLink>
                  </td>
                  <td class="px-4 py-3" @click.stop>
                    <OrderLineItemsInline :items="order.items" compact class="max-w-64" />
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-highlighted">{{ order.customer.name ?? '—' }}</div>
                    <div class="tabular text-xs text-muted">{{ order.customer.phone }}</div>
                  </td>
                  <td class="px-4 py-3 text-muted">{{ order.address.region }}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <StatusBadge :state="order.state" />
                      <UBadge v-if="order.isDuplicate" color="error" variant="subtle" size="sm" title="Same customer + product within the last 2 days">Possible Duplicate</UBadge>
                    </div>
                  </td>
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

        <AdminPagination
          :total="data?.total ?? 0"
          :page="currentPage"
          :page-size="currentPageSize"
          item-label="orders"
          @update:page="goToPage"
          @update:page-size="changePageSize"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
