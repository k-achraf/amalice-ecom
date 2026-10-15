<script setup lang="ts">
import type { AdminOrderListItem, CallCenterStatsResponse } from '@amalice/shared'

// Drop queue: a one-order-at-a-time power dialer. The SERVER hands each agent
// the next order (POST /admin/call-center/claim-next) and locks it to them, so
// two agents never receive the same order; logging a call releases the lock
// and the next claim returns the next-best order (due callbacks first, then
// new leads, then retries — see AdminCallCenterService). "Skip" defers the
// order for everyone for a while. Closing the tab simply lets the lock expire.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] })
useHead({ title: 'Drop Queue — Call Center' })

const api = useAdminApi()
const { run } = useApiAction()

const order = ref<AdminOrderListItem | null>(null)
const loading = ref(true)
const stats = ref<CallCenterStatsResponse | null>(null)

async function loadStats() {
  stats.value = await api<CallCenterStatsResponse>('/admin/call-center/stats').catch(() => stats.value)
}

async function claim() {
  loading.value = true
  const res = await run(() => api<{ order: AdminOrderListItem | null }>('/admin/call-center/claim-next', { method: 'POST' }), { errorFallback: 'Could not load the next order' })
  order.value = res?.order ?? null
  loading.value = false
  loadStats()
}
await claim()

// The workspace asks for a refetch after edits (price, address, item, notes).
async function reloadCurrent() {
  if (!order.value) return
  const fresh = await api<AdminOrderListItem>(`/admin/orders/${order.value.id}`).catch(() => null)
  if (fresh) order.value = fresh
}

async function skip() {
  if (!order.value) return
  const id = order.value.id
  const ok = await run(() => api(`/admin/orders/${id}/skip`, { method: 'POST' }), { errorFallback: 'Could not skip this order' })
  if (ok !== undefined) await claim()
}

// Nothing waiting right now? Poll quietly — a callback may come due or a new
// lead may arrive while the agent is idle.
let idleTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  idleTimer = setInterval(() => {
    if (!order.value && !loading.value) claim()
    else loadStats()
  }, 30_000)
})
onBeforeUnmount(() => {
  if (idleTimer) clearInterval(idleTimer)
  if (order.value) api(`/admin/orders/${order.value.id}/release`, { method: 'POST' }).catch(() => undefined)
})

const myCalls = computed(() => (stats.value ? Object.values(stats.value.me).reduce((a, b) => a + b, 0) : 0))
const remaining = computed(() => (stats.value ? stats.value.queue.new + stats.value.queue.noAnswer + stats.value.queue.postponed + stats.value.queue.abandoned : 0))
</script>

<template>
  <AdsPage title="Drop queue" description="Work through orders one at a time">
    <template #actions>
      <span class="pill neutral">{{ remaining }} waiting</span>
      <NuxtLink to="/call-center" class="btn"><AdsIcon name="i-lucide-list" />Back to queues</NuxtLink>
      <button class="btn" type="button" :disabled="loading" @click="claim"><AdsIcon name="i-lucide-refresh-cw" />Next order</button>
    </template>

    <div class="stack" style="width: 100%; max-width: 760px; margin: 0 auto">
      <section class="kpis" aria-label="Today" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))">
        <AdsKpiCard label="My calls" :value="myCalls" color="dark" />
        <AdsKpiCard label="Confirmed" :value="stats?.me.Confirmed ?? 0" />
        <AdsKpiCard label="No answer" :value="stats?.me.NoAnswer ?? 0" color="warning" />
        <AdsKpiCard label="Wrong #" :value="stats?.me.WrongNumber ?? 0" color="error" />
        <AdsKpiCard label="Callbacks" :value="stats?.me.Postponed ?? 0" />
        <AdsKpiCard label="Team confirmed" :value="stats?.team.Confirmed ?? 0" />
      </section>

      <div v-if="stats" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <span class="muted">Waiting</span>
        <span v-if="stats.queue.dueNow" class="pill returned">{{ stats.queue.dueNow }} callback{{ stats.queue.dueNow > 1 ? 's' : '' }} due</span>
        <span class="pill shipping">{{ stats.queue.new }} new</span>
        <span class="pill new">{{ stats.queue.noAnswer }} retry</span>
        <span class="pill neutral">{{ stats.queue.postponed }} postponed</span>
        <span class="pill outline" title="Customer never finished submitting — lowest priority.">{{ stats.queue.abandoned }} abandoned</span>
        <span class="pill returned" title="Wrong numbers are never auto-dialed; fix the number from the queue page.">{{ stats.queue.wrongNumber }} wrong #</span>
      </div>

      <section v-if="loading && !order" class="card"><div class="empty" style="padding: 60px 20px">Finding the next order…</div></section>
      <section v-else-if="!order" class="card" aria-label="Queue cleared">
        <div class="empty" style="padding: 60px 20px">
          <AdsIcon name="i-lucide-party-popper" style="width: 32px; height: 32px; color: var(--teal); display: block; margin: 0 auto" />
          <h2 style="font-size: 18px; margin-top: 10px; color: var(--pine)">Nothing to call right now</h2>
          <p>Retries and callbacks come back automatically when their time is due. This page checks every 30 seconds.</p>
        </div>
      </section>
      <CallWorkspace v-else :key="order.id" :order="order" shortcuts can-skip @logged="claim" @changed="reloadCurrent" @skip="skip" />

      <p class="muted hide-sm" style="text-align: center">Keyboard: 1 confirm · 2 no answer · 3 wrong number · 4 call back later · 5 cancel · S skip · N note</p>
    </div>
  </AdsPage>
</template>
