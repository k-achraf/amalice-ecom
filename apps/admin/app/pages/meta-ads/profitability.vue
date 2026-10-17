<script setup lang="ts">
import type { MetaAnalyticsLevel, MetaProfitabilityResponse } from '@amalice/shared'
import { ORDER_STATUS_COLORS, gainLossOption, statusBarOption } from '~/lib/meta-charts'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Meta Ads · Profitability' })

const api = useAdminApi()
const toast = useToast()
const { status, accountId, account, datePreset, connected, expired, init } = useMetaAds()

const level = ref<MetaAnalyticsLevel>('campaign')
const data = ref<MetaProfitabilityResponse | null>(null)
const busy = ref(false)
const ready = ref(false)
const failure = ref<string | null>(null)
const levelTabs = [{ label: 'Campaigns', value: 'campaign' }, { label: 'Ad sets', value: 'adset' }, { label: 'Ads', value: 'ad' }]

async function load(refresh = false) {
  if (!accountId.value) return
  busy.value = true
  failure.value = null
  try {
    data.value = await api<MetaProfitabilityResponse>(`/admin/meta-ads/accounts/${accountId.value}/profitability`, { query: { level: level.value, datePreset: datePreset.value, ...(refresh && { refresh: 'true' }) } })
  } catch (err) {
    failure.value = errorMessage(err, 'Could not load the profitability report.')
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
watch([accountId, datePreset, level], () => {
  if (ready.value) load()
})

// Exchange rate: 1 unit of the account's currency in DZD.
const rateInput = ref<number | null>(null)
const savingRate = ref(false)
watch(() => data.value?.exchangeRateToDzd, (r) => { rateInput.value = r ?? null }, { immediate: true })
async function saveRate() {
  if (!accountId.value || !rateInput.value) return
  savingRate.value = true
  try {
    await api(`/admin/meta-ads/accounts/${accountId.value}/exchange-rate`, { method: 'PUT', body: { rate: rateInput.value } })
    await init()
    await load(true)
    toast.add({ title: 'Exchange rate saved', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Exchange rate', description: errorMessage(err, 'Could not save the rate.'), color: 'error' })
  } finally {
    savingRate.value = false
  }
}

const d = computed(() => data.value)
const rows = computed(() => d.value?.rows ?? [])
const rateMissing = computed(() => !!d.value && d.value.exchangeRateToDzd === null)
const levelName = computed(() => ({ campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' })[level.value])
const analyticsLink = (id: string) => `/meta-ads/analytics/${level.value}/${id}`

// Charts: only entities with orders or spend, top 12.
const top = computed(() => rows.value.slice(0, 12))
const profitChart = computed(() =>
  gainLossOption({ names: top.value.map((r) => r.name), values: top.value.map((r) => r.stats.profit ?? r.stats.grossProfit), fmt: (v) => formatDz(v ?? 0), horizontal: true, name: d.value && !rateMissing.value ? 'Profit' : 'Before ad spend' })
)
const outcomeChart = computed(() =>
  statusBarOption({
    names: top.value.map((r) => r.name),
    series: [
      { name: 'Delivered', data: top.value.map((r) => r.stats.delivered), color: ORDER_STATUS_COLORS.delivered },
      { name: 'Returned', data: top.value.map((r) => r.stats.returned), color: ORDER_STATUS_COLORS.returned },
      { name: 'In progress', data: top.value.map((r) => r.stats.inProgress), color: ORDER_STATUS_COLORS.inProgress },
      { name: 'Awaiting confirmation', data: top.value.map((r) => r.stats.pending), color: ORDER_STATUS_COLORS.pending },
      { name: 'Cancelled', data: top.value.map((r) => r.stats.cancelledByCallCenter + r.stats.cancelledAfterConfirm), color: ORDER_STATUS_COLORS.cancelled }
    ]
  })
)
const profitTable = computed(() => ({
  columns: [levelName.value, 'Revenue', 'Costs', 'Ad spend', 'Result'],
  rows: top.value.map((r) => [r.name, formatDz(r.stats.revenue), formatDz(r.stats.productCost + r.stats.courierFees), formatDz(r.stats.adSpend), formatDz(r.stats.profit ?? r.stats.grossProfit)])
}))
const hasOrders = computed(() => rows.value.some((r) => r.stats.orders > 0))
const pill = (s: string | null) => (s === 'ACTIVE' ? 'connected' : s ? 'neutral' : 'neutral')
</script>

<template>
  <AdsPage title="Profitability" description="Meta Ads">
    <AdsBanner v-if="expired" tone="warning">
      Your Meta session expired.
      <NuxtLink to="/meta-ads/accounts" style="font-weight: 600">Reconnect your account</NuxtLink>
    </AdsBanner>
    <AdsEmptyState v-if="status && !status.connection" icon="i-lucide-megaphone" title="Connect your Meta account" description="Link your Facebook account to see how your ads perform on real orders.">
      <NuxtLink to="/meta-ads/accounts" class="btn btn-primary" style="margin-top: 8px">Connect Meta</NuxtLink>
    </AdsEmptyState>

    <template v-else-if="connected">
      <MetaAdsBar :refreshing="busy" @refresh="load(true)" />
      <AdsTabs v-model="level" :items="levelTabs" />
      <AdsBanner v-if="failure" tone="warning">{{ failure }}</AdsBanner>

      <p v-if="rateMissing && account" class="notice warn" style="align-items: center; flex-wrap: wrap; gap: 8px">
        <AdsIcon name="i-lucide-alert-triangle" />
        <span>This ad account spends in {{ account.currency }}. Enter how many DZD 1 {{ account.currency }} is worth to see profit and loss:</span>
        <span style="display: inline-flex; gap: 8px; align-items: center">
          <AdsNumberInput v-model="rateInput" :min="0" style="width: 120px" />
          <button class="btn btn-sm btn-primary" type="button" :disabled="savingRate || !rateInput" @click="saveRate">Save</button>
        </span>
      </p>

      <div v-if="busy && !d" class="empty">Calculating from your orders and Meta…</div>
      <template v-if="d">
        <p v-for="w in d.warnings.filter((x) => !x.startsWith('Set the exchange rate'))" :key="w" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ w }}</span></p>
        <p v-if="d.unlinkedOrders > 0" class="notice warn" style="align-items: center; flex-wrap: wrap; gap: 8px">
          <AdsIcon name="i-lucide-alert-triangle" />
          <span>{{ d.unlinkedOrders }} Meta order(s) couldn't be tied to a {{ levelName.toLowerCase() }} (the ad link has no campaign / ad set / ad parameters, or the name doesn't match).</span>
          <NuxtLink to="/meta-ads/accounts#tracking" class="btn btn-sm" style="margin-inline-start: auto">Add tracking parameters</NuxtLink>
        </p>

        <MetaOrdersSection title="All linked orders" :stats="d.totals" :rate-missing="rateMissing" :account-currency="d.accountCurrency" />

        <template v-if="hasOrders">
          <div class="profit-grid">
            <MetaChartCard :title="`Result by ${levelName.toLowerCase()}`" :subtitle="rateMissing ? 'Before ad spend (DZD)' : 'Profit and loss (DZD)'" :table="profitTable">
              <ChartsEChart :option="profitChart" :height="Math.max(240, top.length * 34 + 40)" :label="`Profit by ${levelName.toLowerCase()}`" />
            </MetaChartCard>
            <MetaChartCard :title="`Order outcomes by ${levelName.toLowerCase()}`" subtitle="Delivered, returned, in progress, awaiting, cancelled">
              <ChartsEChart :option="outcomeChart" :height="Math.max(240, top.length * 34 + 70)" :label="`Order outcomes by ${levelName.toLowerCase()}`" />
            </MetaChartCard>
          </div>
        </template>

        <section class="card flush" aria-label="Breakdown">
          <div class="card-head"><h2>By {{ levelName.toLowerCase() }}</h2><span class="muted">Sorted by {{ rateMissing ? 'revenue' : 'profit' }}</span></div>
          <div class="table-wrap">
            <table style="min-width: 1080px">
              <thead>
                <tr>
                  <th style="padding-left: 20px">{{ levelName }}</th><th class="num">Spend</th><th class="num">Orders</th><th class="num">Confirmed</th><th class="num">Delivered</th><th class="num">Returned</th>
                  <th class="num">Confirm %</th><th class="num">Delivery %</th><th class="num">Return %</th><th class="num">Revenue</th><th class="num">Profit / loss</th><th class="num" style="padding-right: 20px">ROI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!rows.length"><td colspan="12" class="empty">No orders or ad spend in this period.</td></tr>
                <tr v-for="r in rows" :key="r.id" class="clickable" @click="navigateTo(analyticsLink(r.id))">
                  <td style="padding-left: 20px; max-width: 280px">
                    <NuxtLink class="link-cell" :to="analyticsLink(r.id)">{{ r.name }}</NuxtLink>
                    <span class="sub"><span class="pill" :class="pill(r.status)" style="margin-inline-end: 6px">{{ r.status ? metaLabel(r.status) : '—' }}</span>{{ r.id }}</span>
                  </td>
                  <td class="num">{{ r.stats.adSpend === null ? `${r.spendAccountCurrency.toFixed(2)} ${d.accountCurrency ?? ''}` : formatDz(r.stats.adSpend) }}</td>
                  <td class="num">{{ formatCount(r.stats.orders) }}</td>
                  <td class="num">{{ formatCount(r.stats.confirmed) }}</td>
                  <td class="num">{{ formatCount(r.stats.delivered) }}</td>
                  <td class="num">{{ formatCount(r.stats.returned) }}</td>
                  <td class="num">{{ formatPct(r.stats.confirmationRate) }}</td>
                  <td class="num">{{ formatPct(r.stats.deliveryRate) }}</td>
                  <td class="num">{{ formatPct(r.stats.returnRate) }}</td>
                  <td class="num">{{ formatDz(r.stats.revenue) }}</td>
                  <td class="num strong" :style="{ color: (r.stats.profit ?? 0) < 0 ? 'var(--danger-fg)' : undefined }">
                    {{ r.stats.profit === null ? '—' : formatDz(r.stats.profit) }}<span v-if="r.stats.profit !== null" class="sub">{{ r.stats.profit < 0 ? 'Loss' : 'Profit' }}</span>
                  </td>
                  <td class="num" style="padding-right: 20px">{{ formatPct(r.stats.roi, 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p class="hint muted">Orders are matched to ads through the ad link's parameters (campaign_id / adset_id / ad_id, else a unique name in utm_campaign / utm_term / utm_content). Confirmation = confirmed ÷ orders; delivery and return = delivered / returned ÷ confirmed. Revenue counts delivered orders only. Updated {{ new Date(d.fetchedAt).toLocaleTimeString() }}.</p>
      </template>
    </template>
  </AdsPage>
</template>

<style scoped>
.profit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 16px; }
</style>
