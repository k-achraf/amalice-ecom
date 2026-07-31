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

const { data, pending } = await useAdminFetch<CustomerListResponse>('/admin/customers', { key: 'admin-customers' })

const api = useAdminApi()
async function applySearch() {
  await router.push({ query: { search: search.value || undefined, page: 1 } })
  const q: Record<string, string> = { page: '1', pageSize: '20' }
  if (search.value) q.search = search.value
  data.value = await api<CustomerListResponse>('/admin/customers', { query: q })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-4">
        <UInput v-model="search" placeholder="Search by name or phone…" icon="i-lucide-search" @keydown.enter="applySearch" />
        <div class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Customer</th>
                <th class="px-4 py-2.5 text-left">Phone</th>
                <th class="px-4 py-2.5 text-right">Orders</th>
                <th class="px-4 py-2.5 text-right">Total value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pending"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
              <tr v-else-if="!data?.items.length"><td colspan="4" class="px-4 py-12 text-center text-muted">No customers found.</td></tr>
              <tr v-for="c in data?.items" :key="c.id" class="cursor-pointer" @click="navigateTo(`/customers/${c.id}`)">
                <td class="px-4 py-3 font-medium text-highlighted">{{ c.name ?? '—' }}</td>
                <td class="tabular px-4 py-3 text-muted">{{ c.phone }}</td>
                <td class="tabular px-4 py-3 text-right">{{ c.orderCount }}</td>
                <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="c.totalValueCents" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
