<script setup lang="ts">
import { formatPhoneLocal, CALL_CENTER_MAX_ATTEMPTS, type AdminOrderListItem, type CallCenterStatsResponse, type OrderListResponse } from '@amalice/shared'

// Queue view of the call center: the four work queues (waiting / no answer /
// wrong number / postponed) with the selected order opened in the shared
// CallWorkspace. For a one-at-a-time, never-collide flow agents use the Drop
// queue (call-center/drop.vue); this page is for browsing, searching and
// fixing wrong numbers.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] })
useHead({ title: 'Call Center' })

const api = useAdminApi()
const auth = useAuthStore()

// Only orders that still have to be called (confirmed / cancelled ones leave this
// page). 'Abandoned' is not a state: it is a label on orders the customer never
// submitted, so that filter cuts across the queues (an abandoned cart marked
// "wrong number" still shows) but never lists a confirmed or cancelled order.
type QueueState = 'All' | 'PendingCallCenter' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'Abandoned'
const QUEUES: QueueState[] = ['All', 'PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Abandoned']
function queueQuery(s: QueueState): Record<string, string> {
  if (s === 'All') return { scope: 'callcenter' }
  if (s === 'Abandoned') return { scope: 'callcenter', abandoned: 'only' }
  return { state: s }
}

const tab = ref<QueueState>('PendingCallCenter')
const page = ref(1)
const pageSize = ref(25)
const search = ref('')
const items = ref<AdminOrderListItem[]>([])
const total = ref(0)
const counts = reactive<Record<QueueState, number>>({ All: 0, PendingCallCenter: 0, CallCenterNoAnswer: 0, WrongNumber: 0, Postponed: 0, Abandoned: 0 })
const stats = ref<CallCenterStatsResponse | null>(null)
const loading = ref(true)
const selectedId = ref<string | null>(null)

async function loadList() {
  const query: Record<string, string | number> = {
    ...queueQuery(tab.value),
    page: page.value,
    pageSize: pageSize.value,
    ...(tab.value === 'Postponed' ? { sort: 'followup' } : ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber'].includes(tab.value) ? { sort: 'oldest' } : {})
  }
  if (search.value.trim()) query.search = search.value.trim()
  const res = await api<OrderListResponse>('/admin/orders', { query })
  items.value = res.items
  total.value = res.total
  if (!items.value.some((o) => o.id === selectedId.value)) selectedId.value = items.value[0]?.id ?? null
}
async function loadCounts() {
  const results = await Promise.all(QUEUES.map((s) => api<OrderListResponse>('/admin/orders', { query: { ...queueQuery(s), pageSize: 1 } })))
  QUEUES.forEach((s, i) => { counts[s] = results[i]!.total })
}
async function loadStats() {
  stats.value = await api<CallCenterStatsResponse>('/admin/call-center/stats')
}
async function refreshAll() {
  await Promise.all([loadList(), loadCounts(), loadStats()])
}
await refreshAll().catch(() => undefined)
loading.value = false

// Live-ish: new leads and other agents' work show up without a manual reload.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { refreshAll().catch(() => undefined) }, 30_000) })
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (selectedId.value) api(`/admin/orders/${selectedId.value}/release`, { method: 'POST' }).catch(() => undefined)
})

watch([tab, pageSize], () => { page.value = 1; loadList() })
watch(page, () => loadList())
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadList() }, 350)
})

// Free the previous order's claim when the agent moves on to another one.
watch(selectedId, (_id, old) => {
  if (old) api(`/admin/orders/${old}/release`, { method: 'POST' }).catch(() => undefined)
})

const current = computed(() => items.value.find((o) => o.id === selectedId.value) ?? null)
const tabs = computed(() => [
  { label: 'All', value: 'All', count: counts.All },
  { label: 'Waiting', value: 'PendingCallCenter', count: counts.PendingCallCenter },
  { label: 'No answer', value: 'CallCenterNoAnswer', count: counts.CallCenterNoAnswer },
  { label: 'Wrong number', value: 'WrongNumber', count: counts.WrongNumber },
  { label: 'Postponed', value: 'Postponed', count: counts.Postponed },
  { label: 'Abandoned carts', value: 'Abandoned', count: counts.Abandoned }
])
const STATE_LABEL: Record<string, string> = { PendingCallCenter: 'Waiting', CallCenterNoAnswer: 'No answer', WrongNumber: 'Wrong number', Postponed: 'Postponed' }

function waited(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}
function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
function heldByOther(o: AdminOrderListItem) {
  return !!o.lockedUntil && new Date(o.lockedUntil) > new Date() && !!o.assignedToEmail && o.assignedToEmail !== auth.user?.email
}
function followUp(o: AdminOrderListItem) {
  if (!o.postponedUntil) return null
  const d = new Date(o.postponedUntil)
  return { text: d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }), due: d <= new Date() }
}

function onLogged() {
  // The order just left this queue: pick the next one in the list.
  const idx = items.value.findIndex((o) => o.id === selectedId.value)
  const next = items.value[idx + 1] ?? items.value[idx - 1] ?? null
  selectedId.value = next?.id ?? null
  refreshAll()
}
</script>

<template>
  <AdsPage title="Call center" description="Orders waiting for phone confirmation">
    <template #actions>
      <NuxtLink v-if="auth.user && ['SuperAdmin', 'OpsManager'].includes(auth.user.role)" to="/call-center/reports" class="btn"><AdsIcon name="i-lucide-bar-chart-3" />Reports</NuxtLink>
      <NuxtLink to="/call-center/drop" class="btn btn-primary"><AdsIcon name="i-lucide-zap" />Start dialing</NuxtLink>
    </template>

    <section class="kpis" aria-label="Today">
      <AdsKpiCard label="Waiting for a call" :value="counts.PendingCallCenter" color="dark" :meta="stats?.queue.dueNow ? `${stats.queue.dueNow} callback(s) due now` : 'Queue is clear'" />
      <AdsKpiCard label="My calls today" :value="stats ? Object.values(stats.me).reduce((a, b) => a + b, 0) : 0" :meta="stats ? `${stats.me.Confirmed} confirmed` : ''" />
      <AdsKpiCard label="Team confirmed today" :value="stats?.team.Confirmed ?? 0" :meta="stats ? `${stats.team.Cancelled} cancelled · ${stats.team.NoAnswer} no answer` : ''" />
      <AdsKpiCard label="Wrong number" :value="counts.WrongNumber" color="error" meta="Needs a corrected number" />
    </section>

    <div class="split queue-left">
      <section class="card flush" aria-labelledby="q-h">
        <div class="card-head"><h2 id="q-h">Queue <small>{{ total }} orders</small></h2></div>
        <div style="padding: 10px 12px; border-bottom: 1px solid var(--line-soft); display: grid; gap: 8px">
          <AdsTabs v-model="tab" :items="tabs" />
          <AdsSearch v-model="search" soft placeholder="Search name, phone or order #…" />
        </div>
        <div v-if="loading" class="empty">Loading…</div>
        <div v-else-if="!items.length" class="empty">Nothing here. Good job.</div>
        <div v-else class="queue" role="list">
          <button v-for="o in items" :key="o.id" type="button" class="queue-item" role="listitem" :aria-current="o.id === selectedId" @click="selectedId = o.id">
            <span class="initials">{{ initials(o.customer.name) }}</span>
            <span class="meta">
              <b>{{ o.customer.name ?? formatPhoneLocal(o.customer.phone) }}</b>
              <span>#{{ o.id.slice(0, 8) }} · {{ o.address.region }} · <AdsPrice :amount-cents="o.totalCents" /></span>
              <span v-if="o.state === 'Postponed' && followUp(o)" :style="followUp(o)!.due ? 'color: var(--danger, #b42318)' : ''">Callback {{ followUp(o)!.text }}</span>
              <span v-else>{{ o.notes ? o.notes.split('\n').pop() : 'No call note' }}</span>
            </span>
            <span class="side">
              <span class="muted">{{ waited(o.createdAt) }}</span>
              <span v-if="o.isAbandoned" class="pill outline" title="Customer never finished submitting the form.">Abandoned cart</span>
              <span v-if="['All', 'Abandoned'].includes(tab)" class="pill neutral">{{ STATE_LABEL[o.state] ?? o.state }}</span>
              <span v-if="o.callAttemptsCount" class="pill" :class="o.callAttemptsCount >= CALL_CENTER_MAX_ATTEMPTS ? 'returned' : 'neutral'">{{ o.callAttemptsCount }} call{{ o.callAttemptsCount > 1 ? 's' : '' }}</span>
              <span v-if="o.isDuplicate" class="pill returned">Duplicate?</span>
              <RiskBadge v-if="o.riskLevel && o.riskLevel !== 'Low'" :level="o.riskLevel" :score="o.riskScore" :factors="o.riskFactors" />
              <span v-if="heldByOther(o)" class="pill outline" :title="`Being handled by ${o.assignedToEmail}`"><AdsIcon name="i-lucide-lock" style="width: 12px; height: 12px" /> {{ o.assignedToEmail?.split('@')[0] }}</span>
            </span>
          </button>
        </div>
        <AdsPagination :total="total" :page="page" :page-size="pageSize" item-label="orders" :page-size-options="[25, 50, 100]" @update:page="(p) => (page = p)" @update:page-size="(s) => (pageSize = s)" />
      </section>

      <div v-if="!current" class="card">
        <div class="empty" style="padding: 60px 20px">
          <AdsIcon name="i-lucide-check" style="width: 32px; height: 32px; color: var(--teal); display: block; margin: 0 auto" />
          <h2 style="font-size: 18px; margin-top: 10px; color: var(--pine)">Queue is empty</h2>
          <p>Every order in this tab has been called.</p>
        </div>
      </div>
      <div v-else>
        <CallWorkspace :key="current.id" :order="current" @logged="onLogged" @changed="refreshAll" />
      </div>
    </div>
  </AdsPage>
</template>
