<script setup lang="ts">

interface CustomerListItem {
  id: string
  phone: string
  name: string | null
  orderCount: number
  totalValueCents: number
  createdAt: string
}
interface CustomerListResponse {
  items: CustomerListItem[]
  total: number
  page: number
  pageSize: number
}

useHead({ title: 'Customers' })

const route = useRoute()
const router = useRouter()
const search = ref((route.query.search as string) ?? '')

const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))

const { data, pending, refresh: refreshCustomers } = await useAdminFetch<CustomerListResponse>('/admin/customers', {
  key: 'admin-customers',
  query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '20', search: route.query.search }
})

const api = useAdminApi()
async function load() {
  const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  if (search.value) q.search = search.value
  data.value = await api<CustomerListResponse>('/admin/customers', { query: q })
}

async function applySearch() {
  await router.push({ query: { search: search.value || undefined, page: 1 } })
  await load()
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await load()
}

function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await load()
}

// ---- Design chrome: segments, KPI figures and the selected-customer side panel ----
type Row = CustomerListItem
const selectedId = ref<string | null>(null)
const selected = computed<Row | null>(() => data.value?.items.find((c) => c.id === selectedId.value) ?? data.value?.items[0] ?? null)
// Segment is derived from order count (the API has no segment field): 5+ = VIP, 2+ = Repeat, else New.
function segment(c: Row) {
  return c.orderCount >= 5 ? { label: 'VIP', cls: 'vip' } : c.orderCount >= 2 ? { label: 'Repeat', cls: 'repeat' } : { label: 'New', cls: 'newcust' }
}
const rowsOnPage = computed(() => data.value?.items ?? [])
const repeatPct = computed(() => (rowsOnPage.value.length ? Math.round((rowsOnPage.value.filter((c) => c.orderCount >= 2).length / rowsOnPage.value.length) * 100) : 0))
const vipCount = computed(() => rowsOnPage.value.filter((c) => c.orderCount >= 5).length)
const avgValue = computed(() => (rowsOnPage.value.length ? Math.round(rowsOnPage.value.reduce((n, c) => n + c.totalValueCents, 0) / rowsOnPage.value.length / 100).toLocaleString('en-US') : '0'))
function since(iso: string) { return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) }


// ---- Bulk select + permanent delete (SuperAdmin only) ----
const { isSuperAdmin } = useDangerDelete()
const { selected: selIds, allChecked: selAll, indeterminate: selSome, toggleAll: selToggleAll, toggle: selToggle, clear: selClear, count: selCount } = useBulkSelect(computed(() => data.value?.items ?? []))
const { bulkDelete, busy: bulkBusy } = useBulkDelete()
const bulkApi = useAdminApi()

async function deleteSelected() {
  const deleted = await bulkDelete([...selIds.value], { noun: 'customer', warn: `Their orders (${(data.value?.items ?? []).filter((c) => selIds.value.has(c.id)).reduce((n, c) => n + c.orderCount, 0)}) are deleted with them.`, remove: (id) => bulkApi(`/admin/customers/__ID__`.replace('__ID__', id), { method: 'DELETE', query: { withOrders: '1' } }) })
  if (deleted.length) {
    selClear()
    await refreshCustomers()
  }
}
</script>

<template>
  <AdsPage title="Customers" :description="`${(data?.total ?? 0).toLocaleString('en-US')} customers · People who ordered from the store`">
    <template #actions>
      <label class="search"><AdsIcon name="i-lucide-search" /><span class="sr">Search customers</span><input v-model="search" type="search" placeholder="Name or phone" @keydown.enter="applySearch"></label>
    </template>

    <section class="kpis" aria-label="Customer figures">
      <AdsKpiCard label="Customers" :value="(data?.total ?? 0).toLocaleString('en-US')" meta="Matching this search" />
      <AdsKpiCard label="Repeat on this page" :value="`${repeatPct}%`" meta="Ordered 2 times or more" />
      <AdsKpiCard label="Average lifetime value" :value="avgValue" unit="DA" color="dark" :meta="`VIP (5+ orders): ${vipCount} on this page`" />
    </section>

    <div class="row">
      <section class="card wide" aria-label="Customer list" style="padding-top: 12px; padding-bottom: 12px">
        <BulkBar v-if="isSuperAdmin" :count="selCount" :busy="bulkBusy" can-delete @delete="deleteSelected" @clear="selClear" />
      <div class="table-wrap">
          <table style="min-width: 600px">
            <thead><tr><th v-if="isSuperAdmin" style="width: 28px"><input type="checkbox" aria-label="Select all" :checked="selAll" :indeterminate="selSome" @change="selToggleAll(($event.target as HTMLInputElement).checked)"></th><th>Customer</th><th class="num">Orders</th><th class="num">Total spent</th><th>Customer since</th><th>Segment</th></tr></thead>
            <tbody>
              <tr v-if="pending"><td :colspan="5 + (isSuperAdmin ? 1 : 0)" class="empty">Loading…</td></tr>
              <tr v-else-if="!data?.items.length"><td :colspan="5 + (isSuperAdmin ? 1 : 0)" class="empty">No customers found.</td></tr>
              <tr v-for="c in data?.items" v-else :key="c.id" :class="{ selected: c.id === selected?.id }"><td v-if="isSuperAdmin" @click.stop><input type="checkbox" :aria-label="`Select ${c.name ?? c.phone}`" :checked="selIds.has(c.id)" @change="selToggle(c.id, ($event.target as HTMLInputElement).checked)"></td>
                <td>
                  <button class="cust-btn" type="button" :aria-pressed="c.id === selected?.id" @click="selectedId = c.id">
                    <span class="initials">{{ initials(c.name) }}</span>
                    <span><span class="strong">{{ c.name ?? '—' }}</span><span class="sub">{{ c.phone }}</span></span>
                  </button>
                </td>
                <td class="num">{{ c.orderCount }}</td>
                <td class="num strong"><AdsPrice :amount-cents="c.totalValueCents" /></td>
                <td>{{ since(c.createdAt) }}</td>
                <td><span class="pill" :class="segment(c).cls">{{ segment(c).label }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdsPagination :total="data?.total ?? 0" :page="currentPage" :page-size="currentPageSize" item-label="customers" @update:page="goToPage" @update:page-size="changePageSize" />
      </section>

      <aside v-if="selected" class="card narrow" aria-label="Selected customer" aria-live="polite" style="gap: 18px">
        <div style="display: flex; align-items: center; gap: 14px">
          <span class="initials lg">{{ initials(selected.name) }}</span>
          <div class="grow"><h2 style="font-size: 18px">{{ selected.name ?? 'No name given' }}</h2><span class="muted">Customer since {{ since(selected.createdAt) }}</span></div>
          <span class="pill" :class="segment(selected).cls">{{ segment(selected).label }}</span>
        </div>
        <div class="mini-stats">
          <div><span class="muted">Orders</span><b>{{ selected.orderCount }}</b></div>
          <div><span class="muted">Total spent</span><b><AdsPrice :amount-cents="selected.totalValueCents" /></b></div>
        </div>
        <dl class="details"><dt>Phone</dt><dd>{{ selected.phone }}</dd></dl>
        <hr class="divider">
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <NuxtLink :to="`/customers/${selected.id}`" class="btn btn-primary" style="flex: 1 1 auto">View profile &amp; orders</NuxtLink>
          <a class="btn" :href="`tel:${selected.phone}`" style="flex: 1 1 auto"><AdsIcon name="i-lucide-phone" />Call</a>
        </div>
      </aside>
    </div>
  </AdsPage>
</template>
