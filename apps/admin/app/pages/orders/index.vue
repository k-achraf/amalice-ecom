<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, SHIPPING_STATE_TO_ORDER_STATE, ORDER_STATE_LABELS, type OrderState, type OrderListResponse } from '@amalice/shared'
import { getCoreRowModel, useVueTable, type ColumnDef, type RowSelectionState, type VisibilityState } from '@tanstack/vue-table'
import { Search, Archive, ArchiveRestore, StickyNote, Columns3, ArrowRight, Check } from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItemIndicator, DropdownMenuLabel } from 'reka-ui'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'


useHead({ title: 'Orders' })

type Order = OrderListResponse['items'][number]

const route = useRoute()
const router = useRouter()

const ALL_STATES = [
  'PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Confirmed', 'OnHold', 'Packed', 'HandedToCourier',
  'OutForDelivery', 'Delivered', 'CashCollected', 'Reconciled', 'Cancelled', 'DeliveryFailed', 'ReturnedToOrigin', 'Settled', 'CancelledShipping'
] as OrderState[]

const stateOptions = [
  { label: 'All states', value: 'all' },
  ...ALL_STATES.map((s) => ({ label: ORDER_STATE_LABELS[s], value: s }))
]

const search = ref((route.query.search as string) ?? '')
const stateFilter = ref<string | number>((route.query.state as string) ?? 'all')
// Archived orders are excluded by default (see AdminOrdersService.list's
// `archived` param) — this toggles into "browse archived orders only" mode.
const showArchived = ref(route.query.archived === 'only')

const { data, pending } = await useAdminFetch<OrderListResponse>('/admin/orders', {
  key: 'admin-orders',
  query: {
    page: route.query.page ?? '1',
    pageSize: route.query.pageSize ?? '20',
    ...(route.query.archived === 'only' && { archived: 'only' })
  }
})

// useAdminFetch is keyed without reactive query (its option surface is narrow
// by design). After filter/page/pageSize changes we re-fetch manually via the
// api client — this IS the server-side pagination: every page or page-size
// change hits the API again, never slices an already-fetched array client-side.
const api = useAdminApi()
const { run } = useApiAction()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))

async function loadWithFilters() {
  const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  if (stateFilter.value !== 'all') q.state = route.query.state as string
  if (route.query.search) q.search = route.query.search as string
  if (route.query.archived === 'only') q.archived = 'only'
  data.value = await api<OrderListResponse>('/admin/orders', { query: q })
  rowSelection.value = {}
}

function applyFilters() {
  router
    .push({ query: { ...route.query, search: search.value || undefined, state: stateFilter.value !== 'all' ? String(stateFilter.value) : undefined, page: 1 } })
    .then(() => loadWithFilters())
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

// Inline state transition (ADM-04): advance an order to its next valid state
// without opening the detail page — the quick path ops staff use all day.
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

// Soft-hide (see Order.archived's Prisma comment) — reversible toggle.
const archiving = ref<string | null>(null)

async function toggleArchive(orderId: string, currentlyArchived: boolean) {
  archiving.value = orderId
  await run(() => api(`/admin/orders/${orderId}/${currentlyArchived ? 'unarchive' : 'archive'}`, { method: 'POST' }), {
    success: currentlyArchived ? 'Order restored from the archive' : 'Order archived',
    errorFallback: 'Could not update the order'
  })
  await loadWithFilters()
  archiving.value = null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---- TanStack table: row selection + column visibility ----
const columns: ColumnDef<Order>[] = [
  { id: 'select', header: '', enableHiding: false },
  { id: 'order', header: 'Order', enableHiding: false },
  { id: 'products', header: 'Products' },
  { id: 'customer', header: 'Customer' },
  { id: 'wilaya', header: 'Wilaya' },
  { id: 'status', header: 'Status' },
  { id: 'cod', header: 'COD' },
  { id: 'date', header: 'Date' },
  { id: 'actions', header: '', enableHiding: false }
]

const rowSelection = ref<RowSelectionState>({})
const columnVisibility = ref<VisibilityState>({ date: false })

const table = useVueTable({
  get data() { return data.value?.items ?? [] },
  columns,
  getRowId: (row) => row.id,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  enableRowSelection: true,
  state: {
    get rowSelection() { return rowSelection.value },
    get columnVisibility() { return columnVisibility.value }
  },
  onRowSelectionChange: (u) => { rowSelection.value = typeof u === 'function' ? u(rowSelection.value) : u },
  onColumnVisibilityChange: (u) => { columnVisibility.value = typeof u === 'function' ? u(columnVisibility.value) : u }
})

const selectedIds = computed(() => Object.keys(rowSelection.value).filter((id) => rowSelection.value[id]))
const allChecked = computed<boolean | 'indeterminate'>(() =>
  table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? 'indeterminate' : false
)
const visibleColumnCount = computed(() => table.getVisibleLeafColumns().length)

const bulkBusy = ref(false)
async function bulkArchive() {
  bulkBusy.value = true
  const ids = [...selectedIds.value]
  const action = showArchived.value ? 'unarchive' : 'archive'
  let ok = 0
  for (const id of ids) {
    const r = await run(() => api(`/admin/orders/${id}/${action}`, { method: 'POST' }), { errorFallback: `Could not ${action} order ${id.slice(0, 8)}` })
    if (r !== undefined) ok++
  }
  if (ok) await run(async () => undefined, { success: `${ok} order${ok === 1 ? '' : 's'} ${action}d` })
  await loadWithFilters()
  bulkBusy.value = false
}
</script>

<template>
  <AdsPage title="Orders" :description="`${data?.total ?? 0} orders ${showArchived ? 'in the archive' : 'in the pipeline'}`">
    <template #actions>
      <AdsButton appearance="default" class="hide-sm" @click="toggleArchivedView">
        <Archive /> {{ showArchived ? 'Showing archived' : 'Show archived' }}
      </AdsButton>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <AdsButton appearance="default" class="hide-sm"><Columns3 /> Columns</AdsButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="6" class="panel z-50" style="min-width: 200px">
            <DropdownMenuLabel class="menu-label">Visible columns</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              v-for="col in table.getAllLeafColumns().filter((c) => c.getCanHide())"
              :key="col.id"
              :model-value="col.getIsVisible()"
              class="menu-item"
              style="padding-inline-start: 34px"
              @select.prevent
              @update:model-value="(v: boolean) => col.toggleVisibility(v)"
            >
              <DropdownMenuItemIndicator class="absolute inline-flex" style="inset-inline-start: 10px"><Check class="i" style="width: 16px; height: 16px" /></DropdownMenuItemIndicator>
              {{ col.columnDef.header }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </template>

    <section class="card" aria-label="Orders list" style="padding-bottom: 16px">
      <div class="card-head">
        <AdsSelect v-model="stateFilter" :options="stateOptions" class="w-56" @update:model-value="applyFilters" />
        <label class="search soft" style="margin-inline-start: auto">
          <Search class="i" /><span class="sr">Search orders</span>
          <input v-model="search" type="search" placeholder="Order #, name or phone" @keydown.enter="applyFilters">
        </label>
        <AdsButton appearance="default" size="sm" @click="applyFilters">Filter</AdsButton>
      </div>

      <!-- Bulk action bar -->
      <div v-if="selectedIds.length" class="notice" style="align-items: center">
        <span class="strong">{{ selectedIds.length }} selected</span>
        <AdsButton appearance="default" size="sm" :loading="bulkBusy" @click="bulkArchive">
          <component :is="showArchived ? ArchiveRestore : Archive" /> {{ showArchived ? 'Unarchive' : 'Archive' }}
        </AdsButton>
        <AdsButton size="sm" appearance="subtle" style="margin-inline-start: auto" @click="rowSelection = {}">Clear</AdsButton>
      </div>

      <div class="table-wrap">
        <table style="min-width: 900px">
          <thead>
            <tr>
              <th v-for="header in table.getFlatHeaders()" :key="header.id" :style="header.id === 'select' ? 'width: 28px' : undefined" :class="{ num: header.id === 'cod' }">
                <input v-if="header.id === 'select'" type="checkbox" aria-label="Select all orders on this page" :checked="table.getIsAllRowsSelected()" :indeterminate.prop="table.getIsSomeRowsSelected()" @change="table.toggleAllRowsSelected(($event.target as HTMLInputElement).checked)">
                <span v-else-if="header.id === 'actions'" class="sr">Actions</span>
                <template v-else>{{ header.column.columnDef.header }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending"><td :colspan="visibleColumnCount" class="empty">Loading…</td></tr>
            <tr v-else-if="!data?.items.length"><td :colspan="visibleColumnCount" class="empty">No orders match this filter.</td></tr>
            <template v-else>
              <tr v-for="row in table.getRowModel().rows" :key="row.id" :class="{ selected: row.getIsSelected() }" style="cursor: pointer" @click="navigateTo(`/orders/${row.original.id}`)">
                <td v-for="cell in row.getVisibleCells()" :key="cell.id" :class="{ num: cell.column.id === 'cod' || cell.column.id === 'actions' }" :style="cell.column.id === 'products' || cell.column.id === 'status' ? undefined : 'white-space: nowrap'" @click="['select', 'products', 'actions'].includes(cell.column.id) ? $event.stopPropagation() : undefined">
                  <input v-if="cell.column.id === 'select'" type="checkbox" :aria-label="`Select order ${row.original.id.slice(0, 8)}`" :checked="row.getIsSelected()" @change="row.toggleSelected(($event.target as HTMLInputElement).checked)">

                  <span v-else-if="cell.column.id === 'order'">
                    <NuxtLink :to="`/orders/${row.original.id}`" class="strong" style="text-decoration: none; color: var(--pine)" @click.stop>#{{ row.original.id.slice(0, 8) }}</NuxtLink>
                    <span class="sub">{{ fmtDate(row.original.createdAt) }}</span>
                  </span>

                  <OrderLineItemsInline v-else-if="cell.column.id === 'products'" :items="row.original.items" compact style="max-width: 256px" />

                  <template v-else-if="cell.column.id === 'customer'">
                    {{ row.original.customer.name ?? '—' }}
                    <StickyNote v-if="row.original.notes" class="i" style="width: 14px; height: 14px; display: inline; vertical-align: -2px; color: var(--text-2)" :title="row.original.notes" />
                    <span class="sub">{{ row.original.customer.phone }}</span>
                  </template>

                  <template v-else-if="cell.column.id === 'wilaya'">{{ row.original.address.region }}</template>

                  <div v-else-if="cell.column.id === 'status'" style="display: flex; flex-wrap: wrap; gap: 4px">
                    <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[row.original.callCenterState]" />
                    <AdsOrderStatus v-if="row.original.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[row.original.shippingState]" />
                    <span v-if="row.original.isDuplicate" class="pill solid-danger" title="Same customer + product within the last 2 days">Duplicate?</span>
                  </div>

                  <template v-else-if="cell.column.id === 'cod'">
                    <span class="strong"><AdsPrice :amount-cents="row.original.totalCents" /></span>
                    <span class="sub">Cash on delivery</span>
                  </template>

                  <template v-else-if="cell.column.id === 'date'">{{ fmtDate(row.original.createdAt) }}</template>

                  <div v-else-if="cell.column.id === 'actions'" style="display: inline-flex; align-items: center; gap: 4px">
                    <AdsButton appearance="default"
                      v-if="VALID_TRANSITIONS[row.original.state]?.length && row.original.state !== 'Cancelled'"
                      size="sm"
                      style="max-width: 200px"
                      :title="`Move to: ${ORDER_STATE_LABELS[VALID_TRANSITIONS[row.original.state]![0] as OrderState] ?? VALID_TRANSITIONS[row.original.state]![0]}`"
                      :loading="transitioning === row.original.id"
                      @click="advance(row.original.id, row.original.state)"
                    >
                      <ArrowRight /><span class="truncate">{{ ORDER_STATE_LABELS[VALID_TRANSITIONS[row.original.state]![0] as OrderState] ?? VALID_TRANSITIONS[row.original.state]![0] }}</span>
                    </AdsButton>
                    <button
                      class="row-btn"
                      type="button"
                      :title="row.original.archived ? 'Unarchive' : 'Archive'"
                      :aria-label="row.original.archived ? 'Unarchive' : 'Archive'"
                      :disabled="archiving === row.original.id"
                      @click="toggleArchive(row.original.id, row.original.archived)"
                    >
                      <component :is="row.original.archived ? ArchiveRestore : Archive" class="i" style="width: 18px; height: 18px" />
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <AdsPagination
        :total="data?.total ?? 0"
        :page="currentPage"
        :page-size="currentPageSize"
        item-label="orders"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />
    </section>
  </AdsPage>
</template>
