<script setup lang="ts">
import type { AnalyticsOverview, DashboardStats } from '@amalice/shared'

useHead({ title: 'Dashboard' })

const auth = useAuthStore()
const { data: stats } = await useAdminFetch<DashboardStats>('/admin/stats', { key: 'admin-stats' })

// Storefront traffic — first-party view-tracking (packages/shared/src/
// analytics.ts), not third-party pixel data. Own section since it's a
// different data source/refresh cadence than the ops KPIs above, and
// irrelevant to Warehouse's inventory-only view.
const analyticsApi = useAdminApi()
const analyticsDays = ref(7)
const { data: analytics, pending: analyticsPending } = await useAdminFetch<AnalyticsOverview>('/admin/analytics/overview', {
  key: 'admin-analytics-overview',
  query: { days: 7 }
})
const loadingAnalytics = ref(false)
async function setAnalyticsDays(days: number) {
  if (days === analyticsDays.value) return
  analyticsDays.value = days
  loadingAnalytics.value = true
  try {
    analytics.value = await analyticsApi<AnalyticsOverview>('/admin/analytics/overview', { query: { days } })
  } finally {
    loadingAnalytics.value = false
  }
}

const rtoRate = computed(() => {
  if (!stats.value || stats.value.totalOrders30d === 0) return '0%'
  return `${((stats.value.rtoCount30d / stats.value.totalOrders30d) * 100).toFixed(1)}%`
})

// KpiCard's value is a plain string, not a slot — format DZD the same way
// PriceDisplay does rather than hardcoding a currency symbol.
const dzdFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'DZD' })
function formatDzd(cents: number) {
  return dzdFormatter.format(cents / 100)
}

// Role-aware: Warehouse sees inventory-forward cards; others see the ops view.
const isWarehouse = computed(() => auth.role === 'Warehouse')

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="stats" class="space-y-8">
        <!-- Welcome hero band -->
        <div class="admin-hero-band flex flex-col gap-1 p-6">
          <p class="text-sm font-medium text-primary">{{ greeting() }}, {{ auth.user?.email?.split('@')[0] }}</p>
          <h1 class="text-xl font-semibold text-highlighted">
            {{ isWarehouse ? "Here's today's inventory picture." : "Here's what's happening across your store." }}
          </h1>
        </div>

        <section>
          <h2 class="mb-4 text-sm font-medium text-muted">
            {{ isWarehouse ? 'Inventory overview' : 'Operations overview' }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <template v-if="isWarehouse">
              <NuxtLink to="/inventory">
                <KpiCard label="Low-stock products" :value="stats.lowStockCount" icon="i-lucide-alert-triangle" color="error" />
              </NuxtLink>
            </template>
            <template v-else>
              <KpiCard label="Orders today" :value="stats.ordersToday" icon="i-lucide-package" color="primary" />
              <KpiCard
                label="COD pending"
                :value="formatDzd(stats.codAmountPendingCents)"
                icon="i-lucide-banknote"
                color="warning"
              />
              <KpiCard
                label="COD collected"
                :value="formatDzd(stats.codAmountCollectedCents)"
                icon="i-lucide-circle-dollar-sign"
                color="success"
              />
              <KpiCard label="Deliveries today" :value="stats.deliveriesToday" icon="i-lucide-truck" color="info" />
            </template>
          </div>
        </section>

        <section v-if="!isWarehouse">
          <h2 class="mb-4 text-sm font-medium text-muted">Needs attention</h2>
          <div class="admin-kpi-card divide-y divide-[var(--color-admin-border)]">
            <NuxtLink
              to="/call-center"
              class="group flex items-center justify-between p-4 transition-colors hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <span class="admin-icon-chip admin-icon-chip-warning"><UIcon name="i-lucide-phone-call" class="size-4" /></span>
                <span class="font-medium text-highlighted">Awaiting confirmation call</span>
              </span>
              <span class="flex items-center gap-2">
                <UBadge color="warning" variant="subtle">{{ stats.pendingCallCenterCount ?? 0 }}</UBadge>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </NuxtLink>
            <NuxtLink
              to="/fulfillment"
              class="group flex items-center justify-between p-4 transition-colors hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <span class="admin-icon-chip admin-icon-chip-info"><UIcon name="i-lucide-package-check" class="size-4" /></span>
                <span class="font-medium text-highlighted">Confirmed — ready to pack</span>
              </span>
              <span class="flex items-center gap-2">
                <UBadge color="info" variant="subtle">{{ stats.confirmedCount }}</UBadge>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </NuxtLink>
            <NuxtLink
              to="/inventory"
              class="group flex items-center justify-between p-4 transition-colors hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <span class="admin-icon-chip admin-icon-chip-error"><UIcon name="i-lucide-alert-triangle" class="size-4" /></span>
                <span class="font-medium text-highlighted">Low-stock products</span>
              </span>
              <span class="flex items-center gap-2">
                <UBadge color="error" variant="subtle">{{ stats.lowStockCount }}</UBadge>
                <UIcon name="i-lucide-chevron-right" class="size-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </NuxtLink>
          </div>
        </section>

        <section v-if="!isWarehouse" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="RTO rate (30d)" :value="rtoRate" icon="i-lucide-rotate-ccw" color="warning" />
          <KpiCard label="Packed (awaiting dispatch)" :value="stats.packedCount" icon="i-lucide-box" color="info" />
          <KpiCard label="Orders (30d)" :value="stats.totalOrders30d" icon="i-lucide-calendar" color="neutral" />
        </section>

        <!-- Storefront traffic — first-party view-tracking, not third-party
             pixel data (see packages/shared/src/analytics.ts). -->
        <section>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-medium text-muted">Storefront traffic</h2>
            <div class="flex gap-1">
              <UButton
                v-for="opt in [{ label: '24h', days: 1 }, { label: '7d', days: 7 }, { label: '30d', days: 30 }]"
                :key="opt.days"
                size="xs"
                :variant="analyticsDays === opt.days ? 'solid' : 'ghost'"
                :color="analyticsDays === opt.days ? 'primary' : 'neutral'"
                :loading="loadingAnalytics && analyticsDays === opt.days"
                :label="opt.label"
                @click="setAnalyticsDays(opt.days)"
              />
            </div>
          </div>
          <div v-if="analyticsPending && !analytics" class="py-12 text-center text-muted">Loading traffic…</div>
          <template v-else-if="analytics">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total views" :value="analytics.totalViews" icon="i-lucide-eye" color="primary" />
              <KpiCard label="Unique visitors" :value="analytics.uniqueVisitors" icon="i-lucide-users" color="info" />
              <KpiCard label="Product views" :value="analytics.productViews" icon="i-lucide-package" color="success" />
              <KpiCard label="Landing page views" :value="analytics.landingPageViews" icon="i-lucide-rocket" color="warning" />
            </div>

            <div v-if="analytics.topProducts.length || analytics.topLandingPages.length" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div v-if="analytics.topProducts.length" class="admin-kpi-card divide-y divide-[var(--color-admin-border)]">
                <p class="p-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted">Top viewed products</p>
                <div v-for="p in analytics.topProducts" :key="p.id" class="flex items-center justify-between px-4 py-2.5">
                  <span class="truncate text-sm text-highlighted">{{ p.name ?? 'Deleted product' }}</span>
                  <UBadge color="neutral" variant="subtle">{{ p.views }}</UBadge>
                </div>
              </div>
              <div v-if="analytics.topLandingPages.length" class="admin-kpi-card divide-y divide-[var(--color-admin-border)]">
                <p class="p-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted">Top viewed landing pages</p>
                <div v-for="lp in analytics.topLandingPages" :key="lp.id" class="flex items-center justify-between px-4 py-2.5">
                  <span class="truncate text-sm text-highlighted">{{ lp.name ?? 'Deleted landing page' }}<span v-if="lp.subtitle" class="text-muted"> — {{ lp.subtitle }}</span></span>
                  <UBadge color="neutral" variant="subtle">{{ lp.views }}</UBadge>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
      <div v-else class="py-24 text-center text-muted">Loading dashboard…</div>
    </template>
  </UDashboardPanel>
</template>
