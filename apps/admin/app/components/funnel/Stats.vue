<script setup lang="ts">
import type { FunnelStats, FunnelStatsBreakdownRow } from '@amalice/shared'
import { ORDER_STATUS_COLORS, barOption, compactNumber, donutOption, funnelOption, statusBarOption, timeOption } from '~/lib/meta-charts'

// Traffic, engagement and sales of one funnel: visits from the funnel page's own first-party tracking,
// orders from Order.funnelId, then what the call center / couriers did with those orders.
const props = defineProps<{ funnelId: string }>()

const api = useAdminApi()
const days = ref(30)
const loading = ref(true)
const failed = ref(false)
const stats = ref<FunnelStats | null>(null)
const RANGES = [{ label: 'Last 7 days', value: 7 }, { label: 'Last 30 days', value: 30 }, { label: 'Last 90 days', value: 90 }]

async function load() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await api<FunnelStats>(`/admin/funnels/${props.funnelId}/stats`, { query: { days: String(days.value) } })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch([days, () => props.funnelId], load)

function duration(sec: number | null | undefined) {
  if (sec == null) return '—'
  const s = Math.round(sec)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
const SOURCE_LABELS: Record<string, string> = { Meta: 'Facebook / Instagram', TikTok: 'TikTok', Google: 'Google', Snapchat: 'Snapchat', Other: 'Other ads', Organic: 'Organic', Direct: 'Direct', unknown: 'Unknown' }
const label = (k: string) => SOURCE_LABELS[k] ?? (k === 'mobile' ? 'Mobile' : k === 'desktop' ? 'Desktop' : k === 'tablet' ? 'Tablet' : k)

const s = computed(() => stats.value)
const cards = computed(() => {
  const x = s.value
  if (!x) return []
  const t = x.traffic
  const m = x.sales
  const f = x.fulfilment
  return [
    { label: 'Visits', value: formatCount(t.views), hint: `${formatCount(t.uniqueVisitors)} unique visitors` },
    { label: 'Orders', value: formatCount(m.orders), hint: `${formatCount(f.pending)} awaiting confirmation` },
    { label: 'Conversion rate', value: formatPct(m.conversionRate, 2), hint: 'Orders ÷ unique visitors', dark: true },
    { label: 'Avg. time on page', value: duration(t.avgDurationSeconds), hint: t.trackedVisits ? `Over ${formatCount(t.trackedVisits)} measured visits` : 'Measured from now on' },
    { label: 'Bounce rate', value: formatPct(t.bounceRate), hint: 'Left in <10s without scrolling or ordering' },
    { label: 'Avg. scroll depth', value: t.avgScrollDepth == null ? '—' : formatPct(t.avgScrollDepth, 0), hint: 'Share of the page seen' },
    { label: 'Started the form', value: formatCount(t.formStarts), hint: `${formatPct(t.formStartRate)} of visits` },
    { label: 'Form drop-off', value: formatPct(m.formDropOffRate), hint: 'Started the form, did not order' },
    { label: 'Order value', value: formatDz(m.grossValue), hint: m.avgOrderValue == null ? undefined : `${formatDz(m.avgOrderValue)} per order` },
    { label: 'Upsell take rate', value: formatPct(m.upsellRate), hint: `${formatCount(m.ordersWithUpsell)} orders · ${formatDz(m.upsellRevenue)}` },
    { label: 'Confirmation rate', value: formatPct(f.confirmationRate), hint: `${formatCount(f.confirmed)} confirmed` },
    { label: 'Delivery rate', value: formatPct(f.deliveryRate), hint: `${formatCount(f.delivered)} delivered · ${formatCount(f.returned)} returned` }
  ]
})

const dayLabels = computed(() => (s.value?.daily ?? []).map((d) => d.date.slice(5)))
const trafficChart = computed(() => timeOption({
  dates: dayLabels.value,
  fmt: (v) => formatCount(v),
  series: [
    { name: 'Visits', data: (s.value?.daily ?? []).map((d) => d.views), area: true },
    { name: 'Orders', data: (s.value?.daily ?? []).map((d) => d.orders) }
  ]
}))
const trafficTable = computed(() => ({
  columns: ['Day', 'Visits', 'Visitors', 'Orders'],
  rows: (s.value?.daily ?? []).map((d) => [d.date, d.views, d.visitors, d.orders])
}))

const stagesChart = computed(() => {
  const x = s.value
  if (!x) return {}
  return funnelOption([
    { name: 'Visitors', value: x.traffic.uniqueVisitors },
    { name: 'Started the form', value: Math.min(x.traffic.formStarts, x.traffic.uniqueVisitors || x.traffic.formStarts) },
    { name: 'Ordered', value: x.sales.orders },
    { name: 'Confirmed', value: x.fulfilment.confirmed },
    { name: 'Delivered', value: x.fulfilment.delivered }
  ], (v) => formatCount(v))
})
const stagesTable = computed(() => {
  const x = s.value
  const v = x?.traffic.uniqueVisitors ?? 0
  const row = (name: string, n: number) => [name, formatCount(n), v ? formatPct((n / v) * 100, 1) : '—']
  return x ? { columns: ['Stage', 'Count', 'Of visitors'], rows: [row('Visitors', v), row('Started the form', x.traffic.formStarts), row('Ordered', x.sales.orders), row('Confirmed', x.fulfilment.confirmed), row('Delivered', x.fulfilment.delivered)] } : undefined
})

const outcomeChart = computed(() => {
  const f = s.value?.fulfilment
  if (!f) return {}
  return statusBarOption({
    names: ['Orders'],
    series: [
      { name: 'Delivered', data: [f.delivered], color: ORDER_STATUS_COLORS.delivered },
      { name: 'Returned', data: [f.returned], color: ORDER_STATUS_COLORS.returned },
      { name: 'In progress', data: [f.inProgress], color: ORDER_STATUS_COLORS.inProgress },
      { name: 'Awaiting confirmation', data: [f.pending], color: ORDER_STATUS_COLORS.pending },
      { name: 'Cancelled', data: [f.cancelledByCallCenter + f.cancelledAfterConfirm], color: ORDER_STATUS_COLORS.cancelled }
    ]
  })
})
const outcomeTable = computed(() => {
  const f = s.value?.fulfilment
  if (!f) return undefined
  const row = (name: string, n: number) => [name, formatCount(n), f.orders ? formatPct((n / f.orders) * 100) : '—']
  return { columns: ['Outcome', 'Orders', 'Share'], rows: [row('Delivered', f.delivered), row('Returned', f.returned), row('In progress', f.inProgress), row('Awaiting confirmation', f.pending), row('Cancelled at the call center', f.cancelledByCallCenter), row('Cancelled after confirmation', f.cancelledAfterConfirm)] }
})

const deviceChart = computed(() => donutOption({ items: (s.value?.devices ?? []).map((d) => ({ name: label(d.key), value: d.visitors })), fmt: (v) => formatCount(v), centerLabel: 'visitors' }))
const wilayaChart = computed(() => barOption({ categories: (s.value?.wilayas ?? []).map((w) => w.key), values: (s.value?.wilayas ?? []).map((w) => w.orders), fmt: (v) => compactNumber(v ?? 0), name: 'Orders', horizontal: true }))
const wilayaTable = computed(() => ({ columns: ['Wilaya', 'Orders'], rows: (s.value?.wilayas ?? []).map((w) => [w.key, w.orders]) }))
const deviceTable = computed(() => breakdownTable('Device', s.value?.devices ?? []))

function breakdownTable(first: string, rows: FunnelStatsBreakdownRow[]) {
  return { columns: [first, 'Visitors', 'Orders', 'Conversion'], rows: rows.map((r) => [label(r.key), formatCount(r.visitors), formatCount(r.orders), formatPct(r.conversionRate, 2)]) }
}
const empty = computed(() => !!s.value && s.value.traffic.views === 0 && s.value.sales.orders === 0)
</script>

<template>
  <section class="stack" aria-label="Funnel statistics">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap">
      <p class="muted" style="font-size: 13px">Visits are counted from the funnel page itself; orders are the ones placed on this funnel (abandoned carts excluded).</p>
      <AdsSelect v-model="days" :items="RANGES" size="sm" style="width: 160px" aria-label="Period" />
    </div>

    <p v-if="failed" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Could not load the statistics. <button type="button" class="link-cell" style="border: 0; background: none; padding: 0; cursor: pointer" @click="load">Try again</button></span></p>
    <div v-else-if="loading && !stats" class="empty">Loading…</div>
    <template v-else-if="stats">
      <p v-if="empty" class="notice"><AdsIcon name="i-lucide-info" /><span>No visit or order on this funnel in the last {{ days }} days. Statistics appear as soon as visitors open the page.</span></p>

      <div class="kpis">
        <MetaStatCard v-for="c in cards" :key="c.label" :label="c.label" :value="c.value" :hint="c.hint" :dark="c.dark" />
      </div>

      <MetaChartCard title="Visits and orders" subtitle="Per day" :table="trafficTable">
        <ChartsEChart :option="trafficChart" :height="260" label="Visits and orders per day" />
      </MetaChartCard>

      <div class="grid2">
        <MetaChartCard title="Visitor journey" subtitle="From the first visit to delivery" :table="stagesTable">
          <ChartsEChart :option="stagesChart" :height="260" label="Visitor journey" />
        </MetaChartCard>
        <MetaChartCard title="Order outcomes" subtitle="Where each order ended up" :table="outcomeTable">
          <ChartsEChart :option="outcomeChart" :height="150" label="Order outcomes" />
          <p class="muted" style="font-size: 13px">Final delivery rate {{ formatPct(stats.fulfilment.finalDeliveryRate) }} · return rate {{ formatPct(stats.fulfilment.returnRate) }}</p>
        </MetaChartCard>
      </div>

      <div class="grid2">
        <MetaChartCard title="Devices" subtitle="Visitors by device" :table="deviceTable" :empty="!stats.devices.length" empty-text="No visit yet">
          <ChartsEChart :option="deviceChart" :height="240" label="Visitors by device" />
        </MetaChartCard>
        <MetaChartCard title="Top wilayas" subtitle="Orders by delivery wilaya" :table="wilayaTable" :empty="!stats.wilayas.length" empty-text="No order yet">
          <ChartsEChart :option="wilayaChart" :height="240" label="Orders by wilaya" />
        </MetaChartCard>
      </div>

      <div class="grid2">
        <section class="card" aria-label="Traffic sources">
          <div class="card-head"><h2>Traffic sources</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Source</th><th class="num">Visitors</th><th class="num">Orders</th><th class="num">Conversion</th></tr></thead>
              <tbody>
                <tr v-if="!stats.sources.length"><td colspan="4" class="empty">No data yet.</td></tr>
                <tr v-for="r in stats.sources" :key="r.key"><td>{{ label(r.key) }}</td><td class="num">{{ formatCount(r.visitors) }}</td><td class="num">{{ formatCount(r.orders) }}</td><td class="num">{{ formatPct(r.conversionRate, 2) }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="card" aria-label="Campaigns">
          <div class="card-head"><h2>Campaigns</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Campaign</th><th class="num">Visitors</th><th class="num">Orders</th><th class="num">Conversion</th></tr></thead>
              <tbody>
                <tr v-if="!stats.campaigns.length"><td colspan="4" class="empty">No campaign-tagged traffic yet (links need utm_campaign or campaign_name).</td></tr>
                <tr v-for="r in stats.campaigns" :key="r.key"><td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis" :title="r.key">{{ r.key }}</td><td class="num">{{ formatCount(r.visitors) }}</td><td class="num">{{ formatCount(r.orders) }}</td><td class="num">{{ formatPct(r.conversionRate, 2) }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 16px; }
</style>
