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

const { data, pending } = await useAdminFetch<CustomerListResponse>('/admin/customers', {
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
</script>

<template>
  <AdsPage title="Customers" description="People who ordered from the store">
    <template #actions>
      <AdsSearch v-model="search" placeholder="Name or phone" label="Search customers" @keydown.enter="applySearch" />
    </template>

    <section class="kpis" aria-label="Customer figures">
      <AdsKpiCard label="Total customers" :value="(data?.total ?? 0).toLocaleString('en-US')" meta="Matching this search" />
    </section>

    <section class="card" aria-label="Customer list" style="padding-top: 12px; padding-bottom: 12px">
      <div class="table-wrap">
        <table style="min-width: 640px">
          <thead><tr><th>Customer</th><th>Phone</th><th class="num">Orders</th><th class="num">Total spent</th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="4" class="empty">Loading…</td></tr>
            <tr v-else-if="!data?.items.length"><td colspan="4" class="empty">No customers found.</td></tr>
            <tr v-for="c in data?.items" :key="c.id" style="cursor: pointer" @click="navigateTo(`/customers/${c.id}`)">
              <td>
                <NuxtLink :to="`/customers/${c.id}`" class="cust-btn" style="text-decoration: none; color: var(--pine)" @click.stop>
                  <span class="initials">{{ initials(c.name) }}</span>
                  <span class="strong">{{ c.name ?? '—' }}</span>
                </NuxtLink>
              </td>
              <td>{{ c.phone }}</td>
              <td class="num">{{ c.orderCount }}</td>
              <td class="num strong"><AdsPrice :amount-cents="c.totalValueCents" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdsPagination
        :total="data?.total ?? 0"
        :page="currentPage"
        :page-size="currentPageSize"
        item-label="customers"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />
    </section>
  </AdsPage>
</template>
