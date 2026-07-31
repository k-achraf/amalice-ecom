<script setup lang="ts">
import type { DashboardStats } from '@amalice/shared'

useHead({ title: 'Dashboard' })

const auth = useAuthStore()
const { data: stats } = await useAdminFetch<DashboardStats>('/admin/stats', { key: 'admin-stats' })

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
      </div>
      <div v-else class="py-24 text-center text-muted">Loading dashboard…</div>
    </template>
  </UDashboardPanel>
</template>
