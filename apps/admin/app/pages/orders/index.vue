<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, SHIPPING_STATE_TO_ORDER_STATE, ORDER_STATE_LABELS, type OrderState, type OrderListResponse } from '@amalice/shared'
import { getCoreRowModel, useVueTable, type ColumnDef, type RowSelectionState, type VisibilityState } from '@tanstack/vue-table'
import { Search, Archive, ArchiveRestore, StickyNote, Columns3, ArrowRight, Check } from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItemIndicator, DropdownMenuLabel } from 'reka-ui'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

definePageMeta({ layout: 'ads' })
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
const columnVisibility = ref<VisibilityState>({})

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
  <AdsPage title="Orders" description="Every order across the call-center, fulfillment and delivery pipeline." wide>
    <div class="space-y-4">
      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-2">
        <AdsInput v-model="search" placeholder="Order ID, phone, or name" class="w-72" @keydown.enter="applyFilters">
          <template #icon><Search /></template>
        </AdsInput>
        <AdsSelect v-model="stateFilter" :options="stateOptions" class="w-48" @update:model-value="applyFilters" />
        <AdsButton appearance="outline" @click="applyFilters">Filter</AdsButton>
        <AdsButton :appearance="showArchived ? 'primary' : 'subtle'" @click="toggleArchivedView">
          <Archive /> {{ showArchived ? 'Showing archived' : 'Show archived' }}
        </AdsButton>

        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <AdsButton appearance="subtle" class="ms-auto"><Columns3 /> Columns</AdsButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" :side-offset="4" class="ads-root z-50 min-w-48 rounded-ads-lg border border-ads-border bg-ads-surface p-1 shadow-ads-overlay">
              <DropdownMenuLabel class="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ads-subtlest">Visible columns</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                v-for="col in table.getAllLeafColumns().filter((c) => c.getCanHide())"
                :key="col.id"
                :model-value="col.getIsVisible()"
                class="relative flex h-8 cursor-default items-center rounded-ads ps-8 pe-3 text-sm text-ads-text outline-none data-[highlighted]:bg-ads-hover"
                @select.prevent
                @update:model-value="(v: boolean) => col.toggleVisibility(v)"
              >
                <DropdownMenuItemIndicator class="absolute start-2.5 inline-flex"><Check class="size-3.5 text-ads-primary" /></DropdownMenuItemIndicator>
                {{ col.columnDef.header }}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>

      <!-- Bulk action bar -->
      <div v-if="selectedIds.length" class="flex items-center gap-3 rounded-ads-lg border border-ads-primary bg-ads-selected px-4 py-2">
        <span class="text-sm font-medium text-ads-text">{{ selectedIds.length }} selected</span>
        <AdsButton size="sm" appearance="outline" :loading="bulkBusy" @click="bulkArchive">
          <component :is="showArchived ? ArchiveRestore : Archive" /> {{ showArchived ? 'Unarchive' : 'Archive' }}
        </AdsButton>
        <AdsButton size="sm" appearance="subtle" class="ms-auto" @click="rowSelection = {}">Clear</AdsButton>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-ads-lg border border-ads-border bg-ads-surface">
        <table class="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr class="border-b-2 border-ads-border">
              <th v-for="header in table.getFlatHeaders()" :key="header.id" class="h-10 whitespace-nowrap px-3 text-start text-xs font-semibold text-ads-subtle" :class="{ 'w-10': header.id === 'select', 'text-end': header.id === 'cod' || header.id === 'actions' }">
                <AdsCheckbox v-if="header.id === 'select'" :model-value="allChecked" aria-label="Select all orders on this page" @update:model-value="(v) => table.toggleAllRowsSelected(v === true)" />
                <template v-else>{{ header.column.columnDef.header }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending">
              <td :colspan="visibleColumnCount" class="px-3 py-14 text-center text-ads-subtlest">Loading…</td>
            </tr>
            <tr v-else-if="!data?.items.length">
              <td :colspan="visibleColumnCount" class="px-3 py-14 text-center">
                <p class="font-medium text-ads-text">No orders found</p>
                <p class="mt-1 text-ads-subtlest">Try a different search or clear the state filter.</p>
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="row in table.getRowModel().rows"
                :key="row.id"
                class="cursor-pointer border-b border-ads-border last:border-b-0 hover:bg-ads-hover"
                :class="{ 'bg-ads-selected hover:bg-ads-selected-hover': row.getIsSelected() }"
                @click="navigateTo(`/orders/${row.original.id}`)"
              >
                <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-3 py-2.5 align-middle" :class="{ 'whitespace-nowrap': cell.column.id !== 'products' && cell.column.id !== 'status', 'text-end': cell.column.id === 'cod' || cell.column.id === 'actions' }" @click="cell.column.id === 'select' || cell.column.id === 'products' || cell.column.id === 'actions' ? $event.stopPropagation() : undefined">
                  <AdsCheckbox v-if="cell.column.id === 'select'" :model-value="row.getIsSelected()" :aria-label="`Select order ${row.original.id.slice(0, 8)}`" @update:model-value="(v) => row.toggleSelected(v === true)" />

                  <NuxtLink v-else-if="cell.column.id === 'order'" :to="`/orders/${row.original.id}`" class="ads-tabular font-medium text-ads-primary hover:underline" @click.stop>
                    {{ row.original.id.slice(0, 8) }}
                  </NuxtLink>

                  <OrderLineItemsInline v-else-if="cell.column.id === 'products'" :items="row.original.items" compact class="max-w-64" />

                  <template v-else-if="cell.column.id === 'customer'">
                    <div class="flex items-center gap-1.5">
                      <span class="font-medium text-ads-text">{{ row.original.customer.name ?? '—' }}</span>
                      <StickyNote v-if="row.original.notes" class="size-3.5 shrink-0 text-ads-subtlest" :title="row.original.notes" />
                    </div>
                    <div class="ads-tabular text-xs text-ads-subtlest">{{ row.original.customer.phone }}</div>
                  </template>

                  <span v-else-if="cell.column.id === 'wilaya'" class="text-ads-subtle">{{ row.original.address.region }}</span>

                  <div v-else-if="cell.column.id === 'status'" class="flex flex-wrap items-center gap-1">
                    <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[row.original.callCenterState]" />
                    <AdsOrderStatus v-if="row.original.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[row.original.shippingState]" />
                    <AdsLozenge v-if="row.original.isDuplicate" appearance="red" bold title="Same customer + product within the last 2 days">Duplicate?</AdsLozenge>
                  </div>

                  <span v-else-if="cell.column.id === 'cod'" class="ads-tabular font-medium text-ads-text"><PriceDisplay :amount-cents="row.original.totalCents" /></span>

                  <span v-else-if="cell.column.id === 'date'" class="text-ads-subtle">{{ fmtDate(row.original.createdAt) }}</span>

                  <div v-else-if="cell.column.id === 'actions'" class="flex items-center justify-end gap-1">
                    <AdsButton
                      v-if="VALID_TRANSITIONS[row.original.state]?.length && row.original.state !== 'Cancelled'"
                      size="sm"
                      :loading="transitioning === row.original.id"
                      @click="advance(row.original.id, row.original.state)"
                    >
                      <ArrowRight /> {{ ORDER_STATE_LABELS[VALID_TRANSITIONS[row.original.state]![0] as OrderState] ?? VALID_TRANSITIONS[row.original.state]![0] }}
                    </AdsButton>
                    <AdsButton
                      appearance="subtle"
                      size="sm"
                      square
                      :title="row.original.archived ? 'Unarchive' : 'Archive'"
                      :aria-label="row.original.archived ? 'Unarchive' : 'Archive'"
                      :loading="archiving === row.original.id"
                      @click="toggleArchive(row.original.id, row.original.archived)"
                    >
                      <component :is="row.original.archived ? ArchiveRestore : Archive" />
                    </AdsButton>
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
    </div>
  </AdsPage>
</template>
