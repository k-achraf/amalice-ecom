<script setup lang="ts">
import type { DashboardStats } from '@amalice/shared'

useHead({ title: 'Dashboard' })

const auth = useAuthStore()
const { data: stats } = await useAdminFetch<DashboardStats>('/admin/stats', { key: 'admin-stats' })

const rtoRate = computed(() => {
  if (!stats.value || stats.value.totalOrders30d === 0) return '0%'
  return `${((stats.value.rtoCount30d / stats.value.totalOrders30d) * 100).toFixed(1)}%`
})

// Role-aware: Warehouse sees inventory-forward cards; others see the ops view.
const isWarehouse = computed(() => auth.role === 'Warehouse')
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
        <section>
          <h2 class="mb-4 text-sm font-medium text-muted">
            {{ isWarehouse ? 'Inventory overview' : 'Operations overview' }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <template v-if="isWarehouse">
              <NuxtLink to="/inventory">
                <KpiCard label="Low-stock products" :value="stats.lowStockCount" icon="i-lucide-alert-triangle" />
              </NuxtLink>
            </template>
            <template v-else>
              <KpiCard label="Orders today" :value="stats.ordersToday" icon="i-lucide-package" />
              <KpiCard
                label="COD pending"
                :value="`$${(stats.codAmountPendingCents / 100).toFixed(2)}`"
                icon="i-lucide-banknote"
              />
              <KpiCard
                label="COD collected"
                :value="`$${(stats.codAmountCollectedCents / 100).toFixed(2)}`"
                icon="i-lucide-circle-dollar-sign"
              />
              <KpiCard label="Deliveries today" :value="stats.deliveriesToday" icon="i-lucide-truck" />
            </template>
          </div>
        </section>

        <section v-if="!isWarehouse">
          <h2 class="mb-4 text-sm font-medium text-muted">Needs attention</h2>
          <div class="admin-kpi-card divide-y divide-[var(--color-admin-border)]">
            <NuxtLink
              to="/orders?state=PendingOTP"
              class="flex items-center justify-between p-4 hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <UIcon name="i-lucide-clock" class="size-4 text-warning" />
                Awaiting OTP verification
              </span>
              <UBadge color="warning" variant="subtle">{{ stats.pendingOtpCount }}</UBadge>
            </NuxtLink>
            <NuxtLink
              to="/orders?state=Confirmed"
              class="flex items-center justify-between p-4 hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <UIcon name="i-lucide-package-check" class="size-4 text-info" />
                Confirmed — ready to pack
              </span>
              <UBadge color="info" variant="subtle">{{ stats.confirmedCount }}</UBadge>
            </NuxtLink>
            <NuxtLink
              to="/inventory"
              class="flex items-center justify-between p-4 hover:bg-[var(--color-admin-row-hover)]"
            >
              <span class="flex items-center gap-3">
                <UIcon name="i-lucide-alert-triangle" class="size-4 text-error" />
                Low-stock products
              </span>
              <UBadge color="error" variant="subtle">{{ stats.lowStockCount }}</UBadge>
            </NuxtLink>
          </div>
        </section>

        <section v-if="!isWarehouse" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="RTO rate (30d)" :value="rtoRate" icon="i-lucide-rotate-ccw" />
          <KpiCard label="Packed (awaiting dispatch)" :value="stats.packedCount" icon="i-lucide-box" />
          <KpiCard label="Orders (30d)" :value="stats.totalOrders30d" icon="i-lucide-calendar" />
        </section>
      </div>
      <div v-else class="py-24 text-center text-muted">Loading dashboard…</div>
    </template>
  </UDashboardPanel>
</template>
