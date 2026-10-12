<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, SHIPPING_STATE_TO_ORDER_STATE, ORDER_STATE_LABELS, type OrderState, type OrderListResponse } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

useHead({ title: 'Orders' })

const route = useRoute()
const router = useRouter()

// Filter chips = the pipeline stages staff work with daily (design: status tabs);
// every other state is reachable from the "Other states" select.
const CHIPS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'PendingCallCenter' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Packed', value: 'Packed' },
  { label: 'Out for delivery', value: 'OutForDelivery' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' }
]
const OTHER_STATES = [
  'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'OnHold', 'HandedToCourier', 'CashCollected', 'Reconciled',
  'DeliveryFailed', 'ReturnedToOrigin', 'Settled', 'CancelledShipping'
] as OrderState[]
const otherOptions = [{ label: 'Other states…', value: 'all' }, ...OTHER_STATES.map((s) => ({ label: ORDER_STATE_LABELS[s], value: s }))]

const search = ref((route.query.search as string) ?? '')
const stateFilter = ref((route.query.state as string) ?? 'all')
const otherState = computed(() => (OTHER_STATES.includes(stateFilter.value as OrderState) ? stateFilter.value : 'all'))
// Archived orders are excluded by default (see AdminOrdersService.list's `archived`
// param); this toggles into "browse archived orders only" mode.
const showArchived = ref(route.query.archived === 'only')

const { data, pending } = await useAdminFetch<OrderListResponse>('/admin/orders', {
  key: 'admin-orders',
  query: {
    page: route.query.page ?? '1',
    pageSize: route.query.pageSize ?? '20',
    ...(route.query.state && { state: route.query.state }),
    ...(route.query.search && { search: route.query.search }),
    ...(route.query.archived === 'only' && { archived: 'only' })
  }
})

// useAdminFetch is keyed without reactive query (its option surface is narrow by
// design). After filter/page/pageSize changes we re-fetch via the api client: this
// IS the server-side pagination, never a client-side slice.
const api = useAdminApi()
const { run } = useApiAction()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))
const selected = ref<Set<string>>(new Set())

async function loadWithFilters() {
  const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  if (route.query.state) q.state = route.query.state as string
  if (route.query.search) q.search = route.query.search as string
  if (route.query.archived === 'only') q.archived = 'only'
  data.value = await api<OrderListResponse>('/admin/orders', { query: q })
  selected.value = new Set()
}

async function applyFilters(state = stateFilter.value) {
  stateFilter.value = state
  await router.push({ query: { ...route.query, search: search.value || undefined, state: state !== 'all' ? state : undefined, page: 1 } })
  await loadWithFilters()
}

async function toggleArchivedView() {
  showArchived.value = !showArchived.value
  await router.push({ query: { ...route.query, archived: showArchived.value ? 'only' : undefined, page: 1 } })
  await loadWithFilters()
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await loadWithFilters()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await loadWithFilters()
}

// Inline state transition (ADM-04): advance an order to its next valid state without
// opening the detail page, the quick path ops staff use all day.
const transitioning = ref<string | null>(null)

async function advance(orderId: string, currentState: OrderState) {
  const next = VALID_TRANSITIONS[currentState]?.[0]
  if (!next) return
  transitioning.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: next } }), {
    success: `Order moved to ${ORDER_STATE_LABELS[next as OrderState] ?? next}`,
    errorFallback: 'Could not update the order'
  })
  await loadWithFilters()
  transitioning.value = null
}

const bulkBusy = ref(false)
async function bulkArchive() {
  bulkBusy.value = true
  const action = showArchived.value ? 'unarchive' : 'archive'
  let ok = 0
  for (const id of selected.value) {
    const r = await run(() => api(`/admin/orders/${id}/${action}`, { method: 'POST' }), { errorFallback: `Could not ${action} order ${id.slice(0, 8)}` })
    if (r !== undefined) ok++
  }
  if (ok) await run(async () => undefined, { success: `${ok} order${ok === 1 ? '' : 's'} ${action}d` })
  await loadWithFilters()
  bulkBusy.value = false
}

const rows = computed(() => data.value?.items ?? [])
const allChecked = computed(() => rows.value.length > 0 && rows.value.every((o) => selected.value.has(o.id)))
function toggleAll(on: boolean) { selected.value = on ? new Set(rows.value.map((o) => o.id)) : new Set() }
function toggleOne(id: string, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(id)
  else next.delete(id)
  selected.value = next
}

function rowClick(e: MouseEvent, id: string) {
  if (!(e.target as HTMLElement).closest('a, input, button')) navigateTo(`/orders/${id}`)
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function itemsText(o: OrderListResponse['items'][number]) {
  return o.items.map((it) => `${it.product.name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')
}
const deliveryLabel = (t: string | null) => (t === 'Home' ? 'Home' : t === 'Desk' ? 'Stop desk' : '')
const carrier = (o: OrderListResponse['items'][number]) => o.shipment?.courier.name ?? o.shippingCompanyName ?? (o.fulfillmentMethod === 'Manual' ? 'Own driver' : '—')
</script>

<template>
  <AdsPage title="Orders" :description="`${data?.total ?? 0} orders ${showArchived ? 'in the archive' : 'matching'}`">
    <template #actions>
      <button class="btn hide-sm" type="button" @click="toggleArchivedView"><AdsIcon name="i-lucide-archive" />{{ showArchived ? 'Showing archived' : 'Show archived' }}</button>
    </template>

    <section class="card" aria-label="Orders list" style="padding-bottom: 16px">
      <div class="card-head">
        <div class="chips" role="tablist" aria-label="Filter by status">
          <button v-for="c in CHIPS" :key="c.value" class="chip-btn" type="button" role="tab" :aria-selected="stateFilter === c.value" @click="applyFilters(c.value)">{{ c.label }}</button>
        </div>
        <AdsSelect :model-value="otherState" :options="otherOptions" size="sm" style="width: 170px" @update:model-value="(v) => applyFilters(String(v))" />
        <label class="search soft">
          <AdsIcon name="i-lucide-search" /><span class="sr">Search orders</span>
          <input v-model="search" type="search" placeholder="Order #, name or phone" @keydown.enter="applyFilters()">
        </label>
      </div>

      <div class="bulkbar" :class="{ on: selected.size > 0 }">
        <span class="grow">{{ selected.size }} selected</span>
        <button class="btn" type="button" :disabled="bulkBusy" @click="bulkArchive">{{ showArchived ? 'Unarchive' : 'Archive' }}</button>
        <button class="btn" type="button" @click="selected = new Set()">Clear</button>
      </div>

      <div class="table-wrap">
        <table style="min-width: 940px">
          <thead>
            <tr>
              <th style="width: 28px"><input type="checkbox" aria-label="Select all orders on this page" :checked="allChecked" @change="toggleAll(($event.target as HTMLInputElement).checked)"></th>
              <th>Order</th><th>Customer</th><th>Wilaya</th><th>Carrier</th><th>Items</th><th class="num">Total</th><th>Status</th><th><span class="sr">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending"><td colspan="9" class="empty">Loading…</td></tr>
            <tr v-else-if="!rows.length"><td colspan="9" class="empty">No orders match this filter.</td></tr>
            <tr v-for="o in rows" v-else :key="o.id" class="clickable" :class="{ selected: selected.has(o.id) }" @click="rowClick($event, o.id)">
              <td><input type="checkbox" :aria-label="`Select order ${o.id.slice(0, 8)}`" :checked="selected.has(o.id)" @change="toggleOne(o.id, ($event.target as HTMLInputElement).checked)"></td>
              <td><NuxtLink class="link-cell" :to="`/orders/${o.id}`">#{{ o.id.slice(0, 8) }}</NuxtLink><span class="sub">{{ fmtDate(o.createdAt) }}</span></td>
              <td style="white-space: nowrap">{{ o.customer.name ?? '—' }}<AdsIcon v-if="o.notes" name="i-lucide-sticky-note" style="width: 14px; height: 14px; vertical-align: -2px; margin-left: 4px; color: var(--text-2)" :title="o.notes" /><span class="sub">{{ o.customer.phone }}</span></td>
              <td style="white-space: nowrap">{{ o.address.region }}<span class="sub">{{ deliveryLabel(o.shippingType) }}</span></td>
              <td style="white-space: nowrap">{{ carrier(o) }}</td>
              <td class="muted" style="max-width: 240px">{{ itemsText(o) }}</td>
              <td class="num"><span class="strong"><AdsPrice :amount-cents="o.totalCents" /></span><span class="sub">Cash on delivery</span></td>
              <td>
                <div style="display: flex; flex-wrap: wrap; gap: 4px">
                  <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[o.callCenterState]" />
                  <AdsOrderStatus v-if="o.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[o.shippingState]" />
                  <span v-if="o.isDuplicate" class="pill returned" title="Same customer + product within the last 2 days">Duplicate?</span>
                </div>
              </td>
              <td class="num" style="white-space: nowrap">
                <button
                  v-if="VALID_TRANSITIONS[o.state]?.length && o.state !== 'Cancelled'"
                  class="btn btn-sm"
                  type="button"
                  style="max-width: 190px"
                  :disabled="transitioning === o.id"
                  :title="`Move to: ${ORDER_STATE_LABELS[VALID_TRANSITIONS[o.state]![0] as OrderState] ?? VALID_TRANSITIONS[o.state]![0]}`"
                  @click="advance(o.id, o.state)"
                >
                  <AdsIcon name="i-lucide-arrow-right" style="width: 14px; height: 14px" /><span style="overflow: hidden; text-overflow: ellipsis">{{ ORDER_STATE_LABELS[VALID_TRANSITIONS[o.state]![0] as OrderState] ?? VALID_TRANSITIONS[o.state]![0] }}</span>
                </button>
                <NuxtLink class="row-btn" :to="`/orders/${o.id}`" :aria-label="`Open order ${o.id.slice(0, 8)}`"><AdsIcon name="i-lucide-chevron-right" /></NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AdsPagination :total="data?.total ?? 0" :page="currentPage" :page-size="currentPageSize" item-label="orders" @update:page="goToPage" @update:page-size="changePageSize" />
    </section>
  </AdsPage>
</template>
