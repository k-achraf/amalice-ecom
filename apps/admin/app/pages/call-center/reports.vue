<script setup lang="ts">
import { CANCEL_REASONS, type CallCenterReport } from '@amalice/shared'

// Manager view: per-agent performance, daily volume, cancellation reasons and
// speed-to-lead, from the CallAttempt log. Agent commission is a client-side
// calculator (rate per confirmed order) — nothing is stored.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Call center reports' })

const api = useAdminApi()
const { run } = useApiAction()

const range = ref<'today' | '7d' | '30d'>('7d')
const rangeTabs = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' }
]
const report = ref<CallCenterReport | null>(null)
const loading = ref(false)
const commissionDzd = ref<number | null>(0)

function bounds() {
  const to = new Date()
  const from = new Date()
  if (range.value === 'today') from.setHours(0, 0, 0, 0)
  else from.setTime(to.getTime() - (range.value === '7d' ? 7 : 30) * 24 * 3600 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}
async function load() {
  loading.value = true
  const res = await run(() => api<CallCenterReport>('/admin/call-center/report', { query: bounds() }), { errorFallback: 'Could not load the report' })
  if (res) report.value = res
  loading.value = false
}
await load()
watch(range, load)

const pct = (n: number) => `${Math.round(n * 100)}%`
const reasonLabel = (v: string) => CANCEL_REASONS.find((r) => r.value === v)?.label ?? v
const maxDaily = computed(() => Math.max(1, ...(report.value?.daily.map((d) => d.calls) ?? [1])))
const maxReason = computed(() => Math.max(1, ...(report.value?.cancelReasons.map((r) => r.count) ?? [1])))
function commissionFor(confirmedOrders: number) {
  return (commissionDzd.value ?? 0) * confirmedOrders
}
function agentConfirmedOrders(a: CallCenterReport['agents'][number]) {
  return Math.round(a.confirmationRate * a.orders)
}
</script>

<template>
  <AdsPage title="Call center reports" description="Performance of the confirmation team">
    <template #actions>
      <NuxtLink to="/call-center" class="btn"><AdsIcon name="i-lucide-list" />Back to queues</NuxtLink>
      <button class="btn" type="button" :disabled="loading" @click="load"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </template>

    <AdsTabs v-model="range" :items="rangeTabs" />

    <template v-if="report">
      <section class="kpis" aria-label="Totals">
        <AdsKpiCard label="Calls logged" :value="report.totals.calls" color="dark" :meta="`${report.totals.orders} orders worked`" />
        <AdsKpiCard label="Confirmation rate" :value="pct(report.totals.confirmationRate)" :meta="`${report.totals.Confirmed} confirmations`" />
        <AdsKpiCard label="Confirmed value" :value="Math.round(report.totals.confirmedValueCents / 100).toLocaleString('en')" unit="DA" />
        <AdsKpiCard label="Median time to first call" :value="report.medianFirstCallMinutes == null ? '—' : report.medianFirstCallMinutes" :unit="report.medianFirstCallMinutes == null ? '' : 'min'" :color="(report.medianFirstCallMinutes ?? 0) > 60 ? 'warning' : 'neutral'" />
        <AdsKpiCard label="Out of attempts" :value="report.maxedOutOrders" :color="report.maxedOutOrders ? 'error' : 'neutral'" meta="Unconfirmed after max calls" />
      </section>

      <section class="card flush">
        <div class="card-head">
          <h2>Agents</h2>
          <label class="muted" style="display: flex; align-items: center; gap: 8px">Commission per confirmed order (DZD)
            <AdsNumberInput v-model="commissionDzd" :min="0" style="width: 110px" />
          </label>
        </div>
        <div class="table-wrap">
          <table style="min-width: 760px">
            <thead>
              <tr>
                <th style="padding-left: 20px">Agent</th><th class="num">Calls</th><th class="num">Orders</th><th class="num">Confirmed</th>
                <th class="num">No answer</th><th class="num">Wrong #</th><th class="num">Callback</th><th class="num">Cancelled</th>
                <th class="num">Rate</th><th class="num">Value (DA)</th><th class="num" style="padding-right: 20px">Commission</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!report.agents.length"><td colspan="11" class="empty">No calls in this period.</td></tr>
              <tr v-for="a in report.agents" :key="a.agentId ?? a.agentEmail">
                <td style="padding-left: 20px" class="strong">{{ a.agentEmail }}</td>
                <td class="num">{{ a.calls }}</td><td class="num">{{ a.orders }}</td><td class="num strong">{{ a.confirmed }}</td>
                <td class="num">{{ a.noAnswer }}</td><td class="num">{{ a.wrongNumber }}</td><td class="num">{{ a.postponed }}</td><td class="num">{{ a.cancelled }}</td>
                <td class="num">{{ pct(a.confirmationRate) }}</td>
                <td class="num">{{ Math.round(a.confirmedValueCents / 100).toLocaleString('en') }}</td>
                <td class="num" style="padding-right: 20px">{{ commissionFor(agentConfirmedOrders(a)).toLocaleString('en') }} DA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2" style="align-items: start">
        <section class="card">
          <h2 style="font-size: 16px">Daily volume</h2>
          <p v-if="!report.daily.length" class="muted">No data.</p>
          <div v-for="d in report.daily" :key="d.date" style="display: grid; grid-template-columns: 84px 1fr auto; gap: 10px; align-items: center; font-size: 13px">
            <span class="mono muted">{{ d.date.slice(5) }}</span>
            <span style="background: var(--line-soft); border-radius: 4px; height: 10px; overflow: hidden; display: block">
              <span style="display: block; height: 100%; background: var(--teal)" :style="{ width: `${(d.calls / maxDaily) * 100}%` }" />
            </span>
            <span>{{ d.calls }} calls · {{ d.confirmed }} ✓</span>
          </div>
        </section>

        <section class="card">
          <h2 style="font-size: 16px">Cancellation reasons</h2>
          <p v-if="!report.cancelReasons.length" class="muted">No cancellations.</p>
          <div v-for="r in report.cancelReasons" :key="r.reason" style="display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 13px">
            <span>{{ reasonLabel(r.reason) }}</span><b>{{ r.count }}</b>
            <span style="grid-column: 1 / -1; background: var(--line-soft); border-radius: 4px; height: 8px; overflow: hidden; display: block">
              <span style="display: block; height: 100%; background: var(--brass)" :style="{ width: `${(r.count / maxReason) * 100}%` }" />
            </span>
          </div>
        </section>
      </div>
    </template>
  </AdsPage>
</template>
