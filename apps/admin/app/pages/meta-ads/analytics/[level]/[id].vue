<script setup lang="ts">
import { META_ANALYTICS_LEVELS, type MetaAnalyticsLevel, type MetaAnalyticsResponse, type MetaAnalyticsTotals, type MetaBreakdownRow } from '@amalice/shared'
import { ANALYTICS_METRICS, deltaPct, formatMetric, metricByKey } from '~/lib/meta-analytics-metrics'
import { ENTITY_COLORS, barOption, calendarOption, donutOption, funnelOption, scatterOption, stackedBarOption, timeOption } from '~/lib/meta-charts'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })

const route = useRoute()
const level = route.params.level as MetaAnalyticsLevel
const entityId = route.params.id as string
if (!META_ANALYTICS_LEVELS.includes(level)) await navigateTo('/meta-ads/campaigns', { replace: true })

const api = useAdminApi()
const toast = useToast()
const { status, accountId, datePreset, connected, expired, init } = useMetaAds()

const data = ref<MetaAnalyticsResponse | null>(null)
const busy = ref(false)
const ready = ref(false)
const failure = ref<string | null>(null)

async function load(refresh = false) {
  if (!accountId.value) return
  busy.value = true
  failure.value = null
  try {
    data.value = await api<MetaAnalyticsResponse>(`/admin/meta-ads/accounts/${accountId.value}/analytics/${level}/${entityId}`, {
      query: { datePreset: datePreset.value, ...(refresh && { refresh: 'true' }) }
    })
  } catch (err) {
    failure.value = errorMessage(err, 'Could not load the analytics from Meta.')
    toast.add({ title: 'Meta Ads', description: failure.value, color: 'error' })
    await init()
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await init()
  await load()
  ready.value = true
})
// Another ad account doesn't contain this campaign / ad set / ad: go back to its list.
watch([accountId, datePreset], ([account], [previous]) => {
  if (!ready.value) return
  if (account !== previous) return void navigateTo('/meta-ads/campaigns')
  load()
})

const d = computed(() => data.value)
const currency = computed(() => d.value?.currency ?? null)
const t = computed(() => d.value?.totals ?? null)
const prev = computed(() => d.value?.previous ?? null)
const name = computed(() => d.value?.entity.name ?? entityId)
useHead({ title: computed(() => `${name.value} · Analytics`) })

const fmt = (key: string) => (v: number | null | undefined) => formatMetric(metricByKey(key), v, currency.value)
const levelLabel = { campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' }[level]

// ---- header / breadcrumb ----
const campaignId = computed(() => d.value?.entity.campaign?.id ?? (level === 'campaign' ? entityId : null))
const adsetId = computed(() => d.value?.entity.adset?.id ?? (level === 'adset' ? entityId : null))
const listLink = computed(() => (level === 'campaign' ? `/meta-ads/campaigns/${entityId}` : level === 'adset' && campaignId.value ? `/meta-ads/campaigns/${campaignId.value}/${entityId}` : null))

const RANKING_LABELS: Record<string, { text: string; tone: 'connected' | 'neutral' | 'returned' }> = {
  ABOVE_AVERAGE: { text: 'Above average', tone: 'connected' },
  AVERAGE: { text: 'Average', tone: 'neutral' },
  BELOW_AVERAGE_35: { text: 'Below average (bottom 35%)', tone: 'returned' },
  BELOW_AVERAGE_20: { text: 'Below average (bottom 20%)', tone: 'returned' },
  BELOW_AVERAGE_10: { text: 'Below average (bottom 10%)', tone: 'returned' }
}

// ---- KPI cards ----
const OPTIONAL = new Set(['addToCart', 'initiateCheckout', 'landingPageViews', 'leads'])
const KPI_KEYS = ['spend', 'purchases', 'costPerPurchase', 'roas', 'purchaseValue', 'aov', 'conversionRate', 'impressions', 'reach', 'frequency', 'linkClicks', 'ctr', 'cpc', 'cpm', 'landingPageViews', 'addToCart', 'initiateCheckout', 'leads']
const kpis = computed(() => {
  if (!t.value) return []
  return KPI_KEYS.map(metricByKey)
    .filter((m) => !OPTIONAL.has(m.key) || (m.get(t.value!) ?? 0) > 0)
    .map((m) => ({
      key: m.key,
      label: m.label,
      value: formatMetric(m, m.get(t.value!), currency.value),
      delta: prev.value ? deltaPct(m.get(t.value!), m.get(prev.value)) : null,
      lowerIsBetter: m.lowerIsBetter,
      spark: m.daily ? (d.value?.daily ?? []).map((day) => m.get(day)) : undefined
    }))
})
const compareLabel = computed(() => (d.value?.previousRange ? `vs ${d.value.previousRange.since} → ${d.value.previousRange.until}` : null))

// ---- performance over time ----
const dailyMetrics = ANALYTICS_METRICS.filter((m) => m.daily)
const timeMetric = ref('spend')
const compare = ref(true)
const barMode = ref(false)
const dates = computed(() => (d.value?.daily ?? []).map((x) => x.date))
const timeSeries = computed(() => {
  const m = metricByKey(timeMetric.value)
  const series = [{ name: m.label, data: (d.value?.daily ?? []).map((x) => m.get(x)), area: !barMode.value }]
  if (compare.value && d.value?.previousDaily.length) {
    series.push({ name: `${m.label} (previous period)`, data: d.value.previousDaily.map((x) => m.get(x)), area: false, dashed: true } as (typeof series)[number])
  }
  return series
})
const timeChart = computed(() => timeOption({ dates: dates.value, series: timeSeries.value as any, fmt: fmt(timeMetric.value), bars: barMode.value }))
const timeTable = computed(() => {
  const m = metricByKey(timeMetric.value)
  return { columns: ['Date', m.label], rows: (d.value?.daily ?? []).map((x) => [x.date, formatMetric(m, m.get(x), currency.value)]) }
})
const EFFICIENCY = ['roas', 'costPerPurchase', 'ctr', 'cpm']
const efficiencyCharts = computed(() =>
  EFFICIENCY.map((key) => {
    const m = metricByKey(key)
    return { key, label: m.label, option: timeOption({ dates: dates.value, series: [{ name: m.label, data: (d.value?.daily ?? []).map((x) => m.get(x)) }], fmt: fmt(key), small: true }) }
  })
)

// ---- conversion funnel ----
const funnelSteps = computed(() => {
  if (!t.value) return []
  const x = t.value
  const all = [
    { name: 'Impressions', value: x.impressions },
    { name: 'Link clicks', value: x.linkClicks },
    { name: 'Landing page views', value: x.landingPageViews },
    { name: 'Content views', value: x.viewContent },
    { name: 'Add to cart', value: x.addToCart },
    { name: 'Checkouts started', value: x.initiateCheckout },
    { name: 'Purchases', value: x.purchases }
  ]
  return all.filter((s) => s.value > 0)
})
// Impressions dwarf every later step (111K vs 2K), which would squash the funnel: the plot starts at the first click step; the table keeps all steps.
const funnelChart = computed(() => funnelOption(funnelSteps.value.length > 3 ? funnelSteps.value.slice(1) : funnelSteps.value, (v) => formatCount(v ?? 0)))
const funnelTable = computed(() => {
  const steps = funnelSteps.value
  const spend = t.value?.spend ?? 0
  return {
    columns: ['Step', 'Count', 'From previous step', 'Cost per'],
    rows: steps.map((s, i) => [
      s.name,
      formatCount(s.value),
      i === 0 ? '—' : `${((s.value / steps[i - 1]!.value) * 100).toFixed(1)}%`,
      i === 0 ? '—' : formatMoney(spend / s.value, currency.value)
    ])
  }
})

// ---- audience / placement / device ----
const COMPARE_KEYS = ['spend', 'purchases', 'costPerPurchase', 'roas', 'impressions', 'clicks', 'ctr', 'cpm', 'conversionRate']
const SHARE_KEYS = ['spend', 'purchases', 'impressions', 'clicks']
const compareKey = ref('spend')
const shareKey = ref('spend')
const compareMetric = computed(() => metricByKey(compareKey.value))
const shareMetric = computed(() => metricByKey(shareKey.value))
const chipItems = (keys: string[]) => keys.map((k) => ({ label: metricByKey(k).label, value: k }))

const val = (rows: MetaBreakdownRow[] | undefined, key: string) => (rows ?? []).map((r) => metricByKey(key).get(r.metrics))
const labels = (rows: MetaBreakdownRow[] | undefined) => (rows ?? []).map((r) => r.label)
const bd = computed(() => d.value?.breakdowns ?? {})
const tableOf = (rows: MetaBreakdownRow[] | undefined, firstCol: string) => ({
  columns: [firstCol, 'Spend', 'Impressions', 'Clicks', 'Purchases', 'Cost / purchase', 'ROAS'],
  rows: (rows ?? []).map((r) => [
    r.label,
    formatMoney(r.metrics.spend, currency.value),
    formatCount(r.metrics.impressions),
    formatCount(r.metrics.clicks),
    formatCount(r.metrics.purchases),
    formatMoney(r.metrics.costPerPurchase, currency.value),
    r.metrics.roas ? `${r.metrics.roas.toFixed(2)}×` : '—'
  ])
})
const compareBar = (rows: MetaBreakdownRow[] | undefined, horizontal = false, top = 10) => {
  const list = (rows ?? []).filter((r) => r.metrics.spend > 0 || r.metrics.impressions > 0)
  const sorted = horizontal ? [...list].sort((a, b) => (compareMetric.value.get(b.metrics) ?? -1) - (compareMetric.value.get(a.metrics) ?? -1)).slice(0, top) : list
  return barOption({ categories: labels(sorted), values: val(sorted, compareKey.value), fmt: fmt(compareKey.value), name: compareMetric.value.label, horizontal })
}
const donut = (rows: MetaBreakdownRow[] | undefined) =>
  donutOption({ items: (rows ?? []).map((r) => ({ name: r.label, value: shareMetric.value.get(r.metrics) ?? 0 })), fmt: fmt(shareKey.value), centerLabel: shareMetric.value.label, colors: ENTITY_COLORS })
const hasRows = (rows: MetaBreakdownRow[] | undefined) => !!rows?.some((r) => r.metrics.spend > 0 || r.metrics.impressions > 0)

const ageChart = computed(() => compareBar(bd.value.age))
const regionChart = computed(() => compareBar(bd.value.region, true))
const placementChart = computed(() => compareBar(bd.value.placement, true, 8))
const impressionDeviceChart = computed(() => compareBar(bd.value.impressionDevice, true, 8))
const genderDonut = computed(() => donut(bd.value.gender))
const publisherDonut = computed(() => donut(bd.value.publisher))
const deviceDonut = computed(() => donut(bd.value.device))
const ageGenderChart = computed(() => {
  const rows = bd.value.ageGender ?? []
  const ages = [...new Set(rows.map((r) => r.age!))]
  const genders = [...new Set(rows.map((r) => r.gender!))].sort((a, b) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : a.localeCompare(b)))
  return stackedBarOption({
    categories: ages,
    series: genders.slice(0, 4).map((g) => ({
      name: g === 'male' ? 'Men' : g === 'female' ? 'Women' : 'Unknown',
      color: ENTITY_COLORS[g === 'male' ? 'Men' : g === 'female' ? 'Women' : 'Unknown'],
      data: ages.map((a) => shareMetric.value.get(rows.find((r) => r.age === a && r.gender === g)?.metrics ?? ({} as MetaAnalyticsTotals)) ?? 0)
    })),
    fmt: fmt(shareKey.value)
  })
})

// ---- time patterns ----
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekdayChart = computed(() => {
  const sums = Array(7).fill(0) as number[]
  for (const day of d.value?.daily ?? []) {
    const idx = (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7
    sums[idx] = (sums[idx] ?? 0) + (shareMetric.value.get(day) ?? 0)
  }
  return barOption({ categories: WEEKDAYS, values: sums, fmt: fmt(shareKey.value), name: shareMetric.value.label })
})
const calendarChart = computed(() =>
  calendarOption({ days: (d.value?.daily ?? []).map((day) => ({ date: day.date, value: shareMetric.value.get(day) ?? 0 })), fmt: fmt(shareKey.value), name: shareMetric.value.label })
)

// ---- engagement & video ----
const eng = computed(() => t.value?.engagement)
const engagementChart = computed(() =>
  barOption({
    categories: ['Reactions', 'Comments', 'Shares', 'Saves'],
    values: [eng.value?.reactions ?? 0, eng.value?.comments ?? 0, eng.value?.shares ?? 0, eng.value?.saves ?? 0],
    fmt: (v) => formatCount(v ?? 0),
    name: 'Interactions',
    horizontal: true
  })
)
const hasEngagement = computed(() => !!eng.value && eng.value.postEngagement + eng.value.reactions + eng.value.comments + eng.value.shares + eng.value.saves > 0)
const video = computed(() => t.value?.video)
const videoChart = computed(() => {
  const v = video.value
  return barOption({
    categories: ['Plays', '25%', '50%', '75%', '100%'],
    values: [v?.plays ?? 0, v?.p25 ?? 0, v?.p50 ?? 0, v?.p75 ?? 0, v?.p100 ?? 0],
    fmt: (x) => formatCount(x ?? 0),
    name: 'Viewers'
  })
})
const videoTable = computed(() => {
  const v = video.value
  const plays = v?.plays ?? 0
  const row = (label: string, n: number) => [label, formatCount(n), plays ? `${((n / plays) * 100).toFixed(1)}%` : '—']
  return { columns: ['Watched', 'Viewers', '% of plays'], rows: [row('Plays', plays), row('25%', v?.p25 ?? 0), row('50%', v?.p50 ?? 0), row('75%', v?.p75 ?? 0), row('100%', v?.p100 ?? 0), row('ThruPlays', v?.thruplays ?? 0)] }
})

// ---- children (ad sets of a campaign / ads of an ad set) ----
const childLabel = computed(() => (d.value?.childLevel === 'adset' ? 'Ad sets' : 'Ads'))
const children = computed(() => d.value?.children ?? [])
const childChart = computed(() => {
  const sorted = [...children.value].sort((a, b) => (compareMetric.value.get(b.metrics) ?? -1) - (compareMetric.value.get(a.metrics) ?? -1)).slice(0, 10)
  return barOption({ categories: sorted.map((c) => c.name), values: sorted.map((c) => compareMetric.value.get(c.metrics)), fmt: fmt(compareKey.value), name: compareMetric.value.label, horizontal: true })
})
const scatterPoints = computed(() => children.value.filter((c) => c.metrics.spend > 0 && c.metrics.roas !== null).map((c) => ({ name: c.name, x: c.metrics.spend, y: c.metrics.roas as number, size: c.metrics.purchases })))
const scatterChart = computed(() =>
  scatterOption({ points: scatterPoints.value, xName: 'Spend', yName: 'ROAS', sizeName: 'Purchases', fx: fmt('spend'), fy: (v) => (v == null ? '—' : `${v.toFixed(1)}×`), fs: (v) => formatCount(v ?? 0) })
)
const childTable = computed(() => ({
  columns: ['Name', 'Spend', 'Purchases', 'Cost / purchase', 'ROAS', 'CTR'],
  rows: children.value.map((c) => [c.name, formatMoney(c.metrics.spend, currency.value), formatCount(c.metrics.purchases), formatMoney(c.metrics.costPerPurchase, currency.value), c.metrics.roas ? `${c.metrics.roas.toFixed(2)}×` : '—', c.metrics.ctr == null ? '—' : `${c.metrics.ctr.toFixed(2)}%`])
}))
const childAnalyticsLink = (id: string) => `/meta-ads/analytics/${d.value?.childLevel}/${id}`
const budgetText = computed(() => {
  const e = d.value?.entity
  if (!e) return null
  if (e.dailyBudget !== null) return `${formatMoney(e.dailyBudget, currency.value)} per day`
  if (e.lifetimeBudget !== null) return `${formatMoney(e.lifetimeBudget, currency.value)} lifetime`
  return null
})
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : null)
</script>

<template>
  <AdsPage :title="name" :description="`${levelLabel} analytics`">
    <template #breadcrumb>
      <NuxtLink to="/meta-ads/campaigns">Campaigns</NuxtLink>
      <template v-if="level !== 'campaign' && campaignId">
        <AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><NuxtLink :to="`/meta-ads/analytics/campaign/${campaignId}`">{{ d?.entity.campaign?.name ?? campaignId }}</NuxtLink>
      </template>
      <template v-if="level === 'ad' && adsetId">
        <AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><NuxtLink :to="`/meta-ads/analytics/adset/${adsetId}`">{{ d?.entity.adset?.name ?? adsetId }}</NuxtLink>
      </template>
      <AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ name }}</span>
    </template>
    <template v-if="d" #title-extra>
      <span class="pill" :class="metaStatusPill(d.entity.effectiveStatus)" style="margin-inline-start: 10px; vertical-align: middle">{{ metaLabel(d.entity.effectiveStatus) }}</span>
    </template>
    <template v-if="listLink" #actions>
      <NuxtLink :to="listLink" class="btn">{{ level === 'campaign' ? 'Ad sets' : 'Ads' }}<AdsIcon name="i-lucide-arrow-right" /></NuxtLink>
    </template>

    <AdsBanner v-if="expired" tone="warning">
      Your Meta session expired.
      <NuxtLink to="/meta-ads/accounts" style="font-weight: 600">Reconnect your account</NuxtLink>
    </AdsBanner>
    <AdsEmptyState v-if="status && !status.connection" icon="i-lucide-megaphone" title="Connect your Meta account" description="Link your Facebook account to see analytics.">
      <NuxtLink to="/meta-ads/accounts" class="btn btn-primary" style="margin-top: 8px">Connect Meta</NuxtLink>
    </AdsEmptyState>

    <template v-else-if="connected">
      <MetaAdsBar :refreshing="busy" @refresh="load(true)" />
      <AdsBanner v-if="failure" tone="warning">{{ failure }}</AdsBanner>
      <div v-if="busy && !d" class="empty">Loading analytics from Meta…</div>

      <template v-if="d">
        <!-- Entity summary -->
        <section class="card" aria-label="Details" style="flex-direction: row; gap: 16px; align-items: flex-start; flex-wrap: wrap">
          <img v-if="d.entity.thumbnailUrl" :src="d.entity.thumbnailUrl" alt="" style="width: 72px; height: 72px; border-radius: 8px; object-fit: cover; flex-shrink: 0">
          <dl class="details" style="flex: 1 1 320px">
            <dt>{{ levelLabel }} ID</dt><dd>{{ d.entity.id }}</dd>
            <template v-if="d.entity.objective"><dt>Objective</dt><dd>{{ metaLabel(d.entity.objective) }}</dd></template>
            <template v-if="d.entity.optimizationGoal"><dt>Optimization</dt><dd>{{ metaLabel(d.entity.optimizationGoal) }}</dd></template>
            <template v-if="budgetText"><dt>Budget</dt><dd>{{ budgetText }}</dd></template>
            <template v-if="d.entity.startTime"><dt>Schedule</dt><dd>{{ fmtDate(d.entity.startTime) }}<template v-if="d.entity.endTime"> → {{ fmtDate(d.entity.endTime) }}</template></dd></template>
            <template v-if="d.entity.targeting"><dt>Targeting</dt><dd>{{ d.entity.targeting }}</dd></template>
            <template v-if="d.entity.creativeTitle || d.entity.creativeBody"><dt>Creative</dt><dd>{{ [d.entity.creativeTitle, d.entity.creativeBody].filter(Boolean).join(' — ') }}</dd></template>
            <template v-if="d.range"><dt>Period</dt><dd>{{ d.range.since }} → {{ d.range.until }}<template v-if="d.timezone"> ({{ d.timezone }})</template></dd></template>
          </dl>
          <div v-if="d.rankings" style="display: flex; flex-direction: column; gap: 6px; min-width: 220px">
            <b style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2)">Relevance diagnostics</b>
            <template v-for="r in [{ k: 'Quality', v: d.rankings.quality }, { k: 'Engagement rate', v: d.rankings.engagement }, { k: 'Conversion rate', v: d.rankings.conversion }]" :key="r.k">
              <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center">
                <span>{{ r.k }}</span>
                <span v-if="r.v && RANKING_LABELS[r.v]" class="pill" :class="RANKING_LABELS[r.v]!.tone">{{ RANKING_LABELS[r.v]!.text }}</span>
                <span v-else class="muted">Not enough data</span>
              </div>
            </template>
          </div>
        </section>

        <p v-if="!t" class="notice warn" style="align-items: center">
          <AdsIcon name="i-lucide-alert-triangle" />
          <span>No ad delivery in this period, so Meta reports no results.</span>
          <button v-if="datePreset !== 'maximum'" class="btn btn-sm" type="button" style="margin-inline-start: auto" @click="datePreset = 'maximum'">Show all time</button>
        </p>

        <template v-else>
          <!-- KPI cards -->
          <section aria-label="Key figures" style="display: flex; flex-direction: column; gap: 8px">
            <div class="kpis">
              <MetaStatCard v-for="(k, i) in kpis" :key="k.key" :label="k.label" :value="k.value" :delta="k.delta" :lower-is-better="k.lowerIsBetter" :spark="k.spark" :dark="i === 0" />
            </div>
            <p v-if="compareLabel" class="hint muted">Changes are {{ compareLabel }} (same length). Costs going down count as better.</p>
          </section>

          <!-- Orders linked to these ads: rates + profit -->
          <MetaOrdersSection v-if="d.orders" :stats="d.orders" :rate-missing="d.exchangeRateToDzd === null" :account-currency="d.currency" />

          <!-- Over time -->
          <MetaChartCard title="Performance over time" subtitle="One measure at a time, daily" :table="timeTable" :empty="!d.daily.length">
            <template #controls>
              <AdsSelect v-model="timeMetric" :options="dailyMetrics.map((m) => ({ label: m.label, value: m.key }))" size="sm" style="width: 190px" />
              <label class="check" :title="d.previousDaily.length ? undefined : 'No data in the previous period to compare with'"><input v-model="compare" type="checkbox" :disabled="!d.previousDaily.length">Compare to previous period</label>
              <label class="check"><input v-model="barMode" type="checkbox">Bars</label>
            </template>
            <ChartsEChart :option="timeChart" :height="300" :label="`${metricByKey(timeMetric).label} per day`" />
          </MetaChartCard>

          <div class="meta-grid">
            <MetaChartCard v-for="c in efficiencyCharts" :key="c.key" :title="c.label" subtitle="Daily" :empty="!d.daily.length">
              <ChartsEChart :option="c.option" :height="170" :label="`${c.label} per day`" />
            </MetaChartCard>
          </div>

          <!-- Funnel -->
          <MetaChartCard title="Conversion funnel" subtitle="From impression to purchase" :table="funnelTable" :empty="funnelSteps.length < 2" empty-text="Not enough tracked steps to draw a funnel.">
            <ChartsEChart :option="funnelChart" :height="320" label="Conversion funnel" />
          </MetaChartCard>

          <!-- Audience -->
          <section aria-label="Audience" style="display: flex; flex-direction: column; gap: 12px">
            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between">
              <h2 style="font-size: 18px">Audience, placement &amp; device</h2>
              <div style="display: flex; flex-wrap: wrap; gap: 16px">
                <label style="display: flex; align-items: center; gap: 8px">Compare by <AdsSelect v-model="compareKey" :options="chipItems(COMPARE_KEYS)" size="sm" style="width: 170px" /></label>
                <label style="display: flex; align-items: center; gap: 8px">Share of <AdsSelect v-model="shareKey" :options="chipItems(SHARE_KEYS)" size="sm" style="width: 140px" /></label>
              </div>
            </div>
            <div class="meta-grid">
              <MetaChartCard title="Age" :subtitle="compareMetric.label" :table="tableOf(bd.age, 'Age')" :empty="!hasRows(bd.age)">
                <ChartsEChart :option="ageChart" :height="260" :label="`${compareMetric.label} by age`" />
              </MetaChartCard>
              <MetaChartCard title="Gender" :subtitle="`Share of ${shareMetric.label.toLowerCase()}`" :table="tableOf(bd.gender, 'Gender')" :empty="!hasRows(bd.gender)">
                <ChartsEChart :option="genderDonut" :height="260" :label="`${shareMetric.label} by gender`" />
              </MetaChartCard>
              <MetaChartCard title="Age × gender" :subtitle="shareMetric.label" :table="tableOf(bd.ageGender, 'Age · gender')" :empty="!hasRows(bd.ageGender)">
                <ChartsEChart :option="ageGenderChart" :height="260" :label="`${shareMetric.label} by age and gender`" />
              </MetaChartCard>
              <MetaChartCard title="Top regions" :subtitle="`${compareMetric.label} · wilayas`" :table="tableOf(bd.region, 'Region')" :empty="!hasRows(bd.region)">
                <ChartsEChart :option="regionChart" :height="320" :label="`${compareMetric.label} by region`" />
              </MetaChartCard>
              <MetaChartCard title="Platform" :subtitle="`Share of ${shareMetric.label.toLowerCase()}`" :table="tableOf(bd.publisher, 'Platform')" :empty="!hasRows(bd.publisher)">
                <ChartsEChart :option="publisherDonut" :height="260" :label="`${shareMetric.label} by platform`" />
              </MetaChartCard>
              <MetaChartCard title="Placements" :subtitle="compareMetric.label" :table="tableOf(bd.placement, 'Placement')" :empty="!hasRows(bd.placement)">
                <ChartsEChart :option="placementChart" :height="320" :label="`${compareMetric.label} by placement`" />
              </MetaChartCard>
              <MetaChartCard title="Device type" :subtitle="`Share of ${shareMetric.label.toLowerCase()}`" :table="tableOf(bd.device, 'Device')" :empty="!hasRows(bd.device)">
                <ChartsEChart :option="deviceDonut" :height="260" :label="`${shareMetric.label} by device type`" />
              </MetaChartCard>
              <MetaChartCard title="Devices" :subtitle="compareMetric.label" :table="tableOf(bd.impressionDevice, 'Device')" :empty="!hasRows(bd.impressionDevice)">
                <ChartsEChart :option="impressionDeviceChart" :height="260" :label="`${compareMetric.label} by device`" />
              </MetaChartCard>
            </div>
          </section>

          <!-- Time patterns -->
          <div class="meta-grid">
            <MetaChartCard title="By weekday" :subtitle="shareMetric.label" :empty="!d.daily.length">
              <ChartsEChart :option="weekdayChart" :height="240" :label="`${shareMetric.label} by weekday`" />
            </MetaChartCard>
            <MetaChartCard v-if="d.daily.length >= 14" title="Calendar" :subtitle="`${shareMetric.label} per day`">
              <ChartsEChart :option="calendarChart" :height="240" :label="`${shareMetric.label} calendar`" />
            </MetaChartCard>
          </div>

          <!-- Engagement & video -->
          <section v-if="hasEngagement || (video && video.plays > 0)" aria-label="Engagement and video" style="display: flex; flex-direction: column; gap: 12px">
            <h2 style="font-size: 18px">Engagement &amp; video</h2>
            <div class="kpis">
              <MetaStatCard v-if="eng && eng.postEngagement" label="Post engagement" :value="formatCount(eng.postEngagement)" />
              <MetaStatCard v-if="eng && eng.reactions" label="Reactions" :value="formatCount(eng.reactions)" />
              <MetaStatCard v-if="eng && eng.comments" label="Comments" :value="formatCount(eng.comments)" />
              <MetaStatCard v-if="eng && eng.shares" label="Shares" :value="formatCount(eng.shares)" />
              <MetaStatCard v-if="eng && eng.saves" label="Saves" :value="formatCount(eng.saves)" />
              <MetaStatCard v-if="video && video.plays" label="Video plays" :value="formatCount(video.plays)" :hint="video.thruplays ? `${formatCount(video.thruplays)} ThruPlays` : undefined" />
              <MetaStatCard v-if="video && video.avgWatchSeconds" label="Avg. watch time" :value="`${video.avgWatchSeconds.toFixed(1)}s`" />
              <MetaStatCard v-if="video && video.plays && video.p100" label="Watched to the end" :value="`${((video.p100 / video.plays) * 100).toFixed(1)}%`" />
            </div>
            <div class="meta-grid">
              <MetaChartCard v-if="hasEngagement" title="Interactions" subtitle="Reactions, comments, shares, saves">
                <ChartsEChart :option="engagementChart" :height="220" label="Interactions" />
              </MetaChartCard>
              <MetaChartCard v-if="video && video.plays > 0" title="Video retention" subtitle="Viewers reaching each point" :table="videoTable">
                <ChartsEChart :option="videoChart" :height="220" label="Video retention" />
              </MetaChartCard>
            </div>
          </section>

          <!-- Children -->
          <section v-if="d.childLevel && children.length" aria-label="Breakdown by child" style="display: flex; flex-direction: column; gap: 12px">
            <h2 style="font-size: 18px">{{ childLabel }} in this {{ levelLabel.toLowerCase() }}</h2>
            <div class="meta-grid">
              <MetaChartCard :title="`${childLabel} compared`" :subtitle="compareMetric.label" :table="childTable">
                <ChartsEChart :option="childChart" :height="Math.max(220, Math.min(children.length, 10) * 34 + 40)" :label="`${compareMetric.label} by ${childLabel.toLowerCase()}`" />
              </MetaChartCard>
              <MetaChartCard v-if="scatterPoints.length >= 2" title="Spend vs ROAS" subtitle="Bubble size = purchases">
                <ChartsEChart :option="scatterChart" :height="300" label="Spend against ROAS" />
              </MetaChartCard>
            </div>
            <section class="card flush" :aria-label="childLabel">
              <div class="table-wrap">
                <table style="min-width: 1040px">
                  <thead><tr><th style="padding-left: 20px">{{ childLabel.replace(/s$/, '') }}</th><th class="num">Spend</th><th class="num">Purchases</th><th class="num">Cost / purchase</th><th class="num">ROAS</th><th class="num">CTR</th><th class="num">Orders</th><th class="num">Confirm %</th><th class="num">Delivery %</th><th class="num">Return %</th><th class="num" style="padding-right: 20px">Profit / loss</th></tr></thead>
                  <tbody>
                    <tr v-for="c in children" :key="c.id" class="clickable" @click="navigateTo(childAnalyticsLink(c.id))">
                      <td style="padding-left: 20px"><NuxtLink class="link-cell" :to="childAnalyticsLink(c.id)">{{ c.name }}</NuxtLink><span class="sub">{{ c.id }}</span></td>
                      <td class="num strong">{{ formatMoney(c.metrics.spend, currency) }}</td>
                      <td class="num">{{ formatCount(c.metrics.purchases) }}</td>
                      <td class="num">{{ formatMoney(c.metrics.costPerPurchase, currency) }}</td>
                      <td class="num">{{ c.metrics.roas ? `${c.metrics.roas.toFixed(2)}×` : '—' }}</td>
                      <td class="num">{{ c.metrics.ctr == null ? '—' : `${c.metrics.ctr.toFixed(2)}%` }}</td>
                      <td class="num">{{ c.orders ? formatCount(c.orders.orders) : '—' }}</td>
                      <td class="num">{{ formatPct(c.orders?.confirmationRate) }}</td>
                      <td class="num">{{ formatPct(c.orders?.deliveryRate) }}</td>
                      <td class="num">{{ formatPct(c.orders?.returnRate) }}</td>
                      <td class="num strong" style="padding-right: 20px" :style="{ color: (c.orders?.profit ?? 0) < 0 ? 'var(--danger-fg)' : undefined }">{{ c.orders?.profit == null ? '—' : formatDz(c.orders.profit) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <p class="hint muted">Live from Meta (cached 2 minutes) · updated {{ new Date(d.fetchedAt).toLocaleTimeString() }} · results are the pixel's conversions as reported by Meta.</p>
        </template>
      </template>
    </template>
  </AdsPage>
</template>

<style scoped>
.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 16px; }
</style>
