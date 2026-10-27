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
  <AdsPage title="Server logs" :description="`${data?.total ?? 0} log entries · Every warning and error the API logged`">
    <template #actions>
      <button class="btn" type="button" :disabled="loading" @click="manualRefresh"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </template>

    <section class="card" aria-label="Server logs">
      <div class="card-head">
        <AdsTabs :model-value="level" :items="levelOptions" @update:model-value="(v) => applyLevel(v as string)" />
        <AdsSearch v-model="search" soft placeholder="Search message or context…" label="Search logs" @keyup.enter="applySearch" />
      </div>
      <p class="muted" style="padding: 0 20px">
        Separate from the <NuxtLink to="/audit-log" class="link-cell">audit log</NuxtLink>, which records business events rather than errors.
      </p>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>When</th><th>Level</th><th>Context</th><th>Message</th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="4" class="empty">Loading…</td></tr>
            <tr v-else-if="!data?.items.length"><td colspan="4" class="empty">No log entries match this filter.</td></tr>
            <template v-for="entry in data?.items" v-else :key="entry.id">
              <tr :style="entry.trace ? 'cursor: pointer' : ''" @click="entry.trace && toggleExpanded(entry.id)">
                <td class="muted" style="white-space: nowrap">{{ fmtDateTime(entry.createdAt) }}</td>
                <td><span class="pill" :class="entry.level === 'Error' ? 'returned' : 'new'">{{ entry.level }}</span></td>
                <td class="strong">{{ entry.context ?? '—' }}</td>
                <td style="white-space: normal; max-width: 480px">
                  <AdsIcon v-if="entry.trace" :name="expandedId === entry.id ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" style="width: 14px; height: 14px; vertical-align: -2px" />
                  {{ entry.message }}
                </td>
              </tr>
              <tr v-if="entry.trace && expandedId === entry.id">
                <td colspan="4"><pre class="mono muted" style="white-space: pre-wrap; max-height: 256px; overflow: auto; margin: 0">{{ entry.trace }}</pre></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <AdsPagination :total="data?.total ?? 0" :page="currentPage" :page-size="currentPageSize" item-label="log entries" @update:page="goToPage" @update:page-size="changePageSize" />
    </section>
  </AdsPage>
</template>
