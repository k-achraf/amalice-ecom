<script setup lang="ts">
import type { AnalyticsOverview, DashboardStats } from '@amalice/shared'
import { Bell } from 'lucide-vue-next'

useHead({ title: 'Overview' })

const auth = useAuthStore()
const { data: stats } = await useAdminFetch<DashboardStats>('/admin/stats', { key: 'admin-stats' })

// Storefront traffic: first-party view-tracking (packages/shared/src/analytics.ts),
// not third-party pixel data. Own section since it's a different data source /
// refresh cadence than the ops KPIs, and irrelevant to Warehouse's inventory view.
const analyticsApi = useAdminApi()
const analyticsDays = ref('7')
const { data: analytics, pending: analyticsPending } = await useAdminFetch<AnalyticsOverview>('/admin/analytics/overview', {
  key: 'admin-analytics-overview',
  query: { days: 7 }
})
const loadingAnalytics = ref(false)
watch(analyticsDays, async (days) => {
  loadingAnalytics.value = true
  try {
    analytics.value = await analyticsApi<AnalyticsOverview>('/admin/analytics/overview', { query: { days: Number(days) } })
  } finally {
    loadingAnalytics.value = false
  }
})

const rtoRate = computed(() => {
  if (!stats.value || stats.value.totalOrders30d === 0) return '0%'
  return `${((stats.value.rtoCount30d / stats.value.totalOrders30d) * 100).toFixed(1)}%`
})

// Money is shown the design's way: "3,651 DA", no currency symbol or decimals.
const money = (cents: number) => Math.round(cents / 100).toLocaleString('en-US')

// Role-aware: Warehouse sees inventory-forward cards; others see the ops view.
const isWarehouse = computed(() => auth.role === 'Warehouse')

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${auth.user?.email?.split('@')[0] ?? ''}`
})
const initials = computed(() => (auth.user?.email ?? '?').slice(0, 2).toUpperCase())

const attention = computed(() => stats.value
  ? [
      { label: 'Awaiting confirmation call', to: '/call-center', count: stats.value.pendingCallCenterCount ?? 0, color: 'var(--brass)' },
      { label: 'Confirmed — ready to pack', to: '/fulfillment', count: stats.value.confirmedCount, color: 'var(--sage)' },
      { label: 'Low-stock products', to: '/inventory', count: stats.value.lowStockCount, color: 'var(--danger)' }
    ]
  : [])
</script>

<template>
  <AdsPage title="Overview" :description="greeting">
    <template #actions>
      <div class="actions hide-sm">
        <button class="icon-btn" type="button" aria-label="Notifications"><Bell class="i" /></button>
        <span class="avatar-btn" style="display: inline-flex; align-items: center; justify-content: center" aria-hidden="true">{{ initials }}</span>
      </div>
    </template>

    <template v-if="stats">
      <section class="kpis" aria-label="Key figures">
        <template v-if="isWarehouse">
          <NuxtLink to="/inventory" style="text-decoration: none; color: inherit">
            <AdsKpiCard label="Low-stock products" :value="stats.lowStockCount" color="error" />
          </NuxtLink>
        </template>
        <template v-else>
          <AdsKpiCard label="COD collected" :value="money(stats.codAmountCollectedCents)" unit="DA" color="dark" meta="Collected from couriers" />
          <AdsKpiCard label="Orders today" :value="stats.ordersToday" meta="Placed since midnight" />
          <AdsKpiCard label="COD pending" :value="money(stats.codAmountPendingCents)" unit="DA" color="warning" meta="Still to collect" />
          <AdsKpiCard label="Deliveries today" :value="stats.deliveriesToday" meta="Parcels delivered today" />
        </template>
      </section>

      <div v-if="!isWarehouse" class="row stretch">
        <section class="card wide" aria-labelledby="att-h">
          <div class="card-head"><h2 id="att-h">Needs attention</h2></div>
          <ul class="list">
            <li v-for="a in attention" :key="a.to">
              <span class="sw" :style="{ background: a.color }" />
              <NuxtLink :to="a.to" class="grow" style="text-decoration: none; color: var(--pine)">{{ a.label }}</NuxtLink>
              <b>{{ a.count }}</b>
            </li>
          </ul>
          <NuxtLink to="/call-center" class="btn btn-primary" style="margin-top: auto">Open the call-center queue</NuxtLink>
        </section>

        <section class="card narrow" aria-labelledby="rto-h">
          <div class="card-head"><h2 id="rto-h">Last 30 days</h2></div>
          <ul class="list">
            <li><span class="grow">Orders</span><b>{{ stats.totalOrders30d }}</b></li>
            <li><span class="grow">Packed (awaiting dispatch)</span><b>{{ stats.packedCount }}</b></li>
            <li><span class="grow">RTO rate</span><b>{{ rtoRate }}</b></li>
          </ul>
        </section>
      </div>

      <!-- Storefront traffic: first-party view-tracking (see packages/shared/src/analytics.ts). -->
      <section class="card" aria-labelledby="traffic-h">
        <div class="card-head">
          <h2 id="traffic-h">Storefront traffic</h2>
          <AdsTabs v-model="analyticsDays" plain :items="[{ label: '24h', value: '1' }, { label: '7 days', value: '7' }, { label: '30 days', value: '30' }]" />
        </div>
        <div v-if="analyticsPending && !analytics" class="empty">Loading traffic…</div>
        <template v-else-if="analytics">
          <div class="kpis" :style="{ opacity: loadingAnalytics ? 0.5 : 1 }">
            <AdsKpiCard label="Total views" :value="analytics.totalViews" />
            <AdsKpiCard label="Unique visitors" :value="analytics.uniqueVisitors" />
            <AdsKpiCard label="Product views" :value="analytics.productViews" />
            <AdsKpiCard label="Landing page views" :value="analytics.landingPageViews" />
          </div>

          <div v-if="analytics.topProducts.length || analytics.topLandingPages.length" class="row">
            <div v-if="analytics.topProducts.length" class="narrow" style="flex-basis: 320px">
              <h3 style="font-size: 14px; margin-bottom: 8px">Top viewed products</h3>
              <ul class="list">
                <li v-for="p in analytics.topProducts" :key="p.id"><span class="grow">{{ p.name ?? 'Deleted product' }}</span><b>{{ p.views }}</b></li>
              </ul>
            </div>
            <div v-if="analytics.topLandingPages.length" class="narrow" style="flex-basis: 320px">
              <h3 style="font-size: 14px; margin-bottom: 8px">Top viewed landing pages</h3>
              <ul class="list">
                <li v-for="lp in analytics.topLandingPages" :key="lp.id">
                  <span class="grow">{{ lp.name ?? 'Deleted landing page' }}<span v-if="lp.subtitle" class="muted"> — {{ lp.subtitle }}</span></span><b>{{ lp.views }}</b>
                </li>
              </ul>
            </div>
          </div>
        </template>
      </section>
    </template>
    <div v-else class="empty">Loading overview…</div>
  </AdsPage>
</template>
