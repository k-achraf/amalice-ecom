<script setup lang="ts">
import type { ServerLogLevel, ServerLogResponse } from '@amalice/shared'

// Operational error/warning logs — every `Logger.warn()`/`.error()` call
// anywhere in the API (stock races, DHD webhook signature failures, Google
// Sheets push failures, etc.), captured server-side by PersistentLogger.
// Distinct from /audit-log: that page is business events (order state
// changed, product edited); this one is infrastructure noise ops staff
// would otherwise only see via SSH + `pm2 logs`.
definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Server Logs' })

const route = useRoute()
const router = useRouter()
const api = useAdminApi()

const level = ref((route.query.level as ServerLogLevel | '') ?? '')
const search = ref((route.query.search as string) ?? '')
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 50))

const { data, pending } = await useAdminFetch<ServerLogResponse>('/admin/server-performance/logs', {
  key: 'admin-server-logs',
  query: {
    level: route.query.level || undefined,
    search: route.query.search || undefined,
    page: route.query.page ?? '1',
    pageSize: route.query.pageSize ?? '50'
  }
})

const loading = ref(false)
async function load() {
  loading.value = true
  try {
    const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
    if (level.value) q.level = level.value
    if (search.value.trim()) q.search = search.value.trim()
    data.value = await api<ServerLogResponse>('/admin/server-performance/logs', { query: q })
  } finally {
    loading.value = false
  }
}

async function applyLevel(v: string) {
  level.value = v as ServerLogLevel | ''
  await router.push({ query: { ...route.query, level: v || undefined, page: 1 } })
  await load()
}

async function applySearch() {
  await router.push({ query: { ...route.query, search: search.value || undefined, page: 1 } })
  await load()
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await load()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await load()
}

async function manualRefresh() {
  await load()
}

const levelOptions = [
  { label: 'All', value: '' },
  { label: 'Error', value: 'Error' },
  { label: 'Warn', value: 'Warn' }
]

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

// Expand/collapse a row's trace (only Error entries with a stack trace ever
// have one) rather than always showing it inline — most rows don't have a
// trace, and the ones that do are often long.
const expandedId = ref<string | null>(null)
function toggleExpanded(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Server Logs">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton icon="i-lucide-refresh-cw" size="sm" variant="outline" color="neutral" :loading="loading" @click="manualRefresh" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-muted">
          Every warning/error the API logged, across all services — separate from
          <NuxtLink to="/audit-log" class="text-primary underline">Audit Log</NuxtLink> (business events, not errors).
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-muted">Level:</span>
          <USelect :model-value="level" :items="levelOptions" class="w-40" @update:model-value="(v) => applyLevel(v as string)" />
          <UInput v-model="search" icon="i-lucide-search" placeholder="Search message or context…" class="w-72" @keyup.enter="applySearch" />
          <UButton size="sm" variant="outline" color="neutral" :loading="loading" @click="applySearch">Search</UButton>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">When</th>
                <th class="px-4 py-2.5 text-left">Level</th>
                <th class="px-4 py-2.5 text-left">Context</th>
                <th class="px-4 py-2.5 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pending"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
              <tr v-else-if="!data?.items.length"><td colspan="4" class="px-4 py-12 text-center text-muted">No log entries match this filter.</td></tr>
              <template v-for="entry in data?.items" :key="entry.id">
                <tr
                  :class="entry.trace ? 'cursor-pointer' : ''"
                  @click="entry.trace && toggleExpanded(entry.id)"
                >
                  <td class="px-4 py-3 whitespace-nowrap text-muted">{{ fmtDateTime(entry.createdAt) }}</td>
                  <td class="px-4 py-3">
                    <UBadge :color="entry.level === 'Error' ? 'error' : 'warning'" variant="subtle">{{ entry.level }}</UBadge>
                  </td>
                  <td class="px-4 py-3 text-highlighted">{{ entry.context ?? '—' }}</td>
                  <td class="max-w-md whitespace-normal px-4 py-3 text-muted">
                    <div class="flex items-start gap-1.5">
                      <UIcon v-if="entry.trace" :name="expandedId === entry.id ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="mt-0.5 size-3.5 shrink-0" />
                      <span>{{ entry.message }}</span>
                    </div>
                  </td>
                </tr>
                <tr v-if="entry.trace && expandedId === entry.id">
                  <td colspan="4" class="bg-[var(--color-admin-surface-tint)] px-4 py-3">
                    <pre class="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">{{ entry.trace }}</pre>
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
          item-label="log entries"
          @update:page="goToPage"
          @update:page-size="changePageSize"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
