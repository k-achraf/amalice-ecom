<script setup lang="ts">
import type { ServerPerformanceSnapshot } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Server Performance' })

const api = useAdminApi()
const toast = useToast()

const snapshot = ref<ServerPerformanceSnapshot | null>(null)
const loading = ref(true)
const errorMessage = ref<string | null>(null)
const autoRefresh = ref(true)
let timer: ReturnType<typeof setInterval> | undefined

async function fetchSnapshot() {
  try {
    snapshot.value = await api<ServerPerformanceSnapshot>('/admin/server-performance')
    errorMessage.value = null
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    errorMessage.value = data?.message ?? 'Failed to load server performance data.'
  } finally {
    loading.value = false
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  timer = setInterval(fetchSnapshot, 5000)
}
function stopAutoRefresh() {
  if (timer) clearInterval(timer)
  timer = undefined
}

watch(autoRefresh, (on) => (on ? startAutoRefresh() : stopAutoRefresh()))

onMounted(() => {
  fetchSnapshot()
  if (autoRefresh.value) startAutoRefresh()
})
onBeforeUnmount(stopAutoRefresh)

function bytesToGb(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(2)
}
function bytesToMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}
function fmtDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
function fmtMs(ms: number | null): string {
  return ms == null ? '—' : `${ms}ms`
}

function barColor(percent: number): string {
  if (percent >= 90) return 'var(--color-error, #ef4444)'
  if (percent >= 70) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-primary, #10b981)'
}

const pm2StatusColor: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  online: 'success',
  stopped: 'neutral',
  errored: 'error',
  stopping: 'warning',
  launching: 'warning'
}

async function manualRefresh() {
  loading.value = true
  await fetchSnapshot()
  toast.add({ title: 'Refreshed', color: 'success' })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Server Performance">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted">Auto-refresh</span>
            <USwitch v-model="autoRefresh" />
            <UButton icon="i-lucide-refresh-cw" size="sm" variant="outline" color="neutral" :loading="loading" @click="manualRefresh" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="loading && !snapshot" class="py-24 text-center text-muted">Loading…</div>
      <div v-else-if="errorMessage && !snapshot" class="py-24 text-center">
        <p class="text-error">{{ errorMessage }}</p>
      </div>
      <div v-else-if="snapshot" class="max-w-5xl space-y-6">
        <p v-if="errorMessage" class="rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">{{ errorMessage }} — showing last successful snapshot.</p>

        <!-- KPI row -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="admin-kpi-card p-4">
            <p class="text-xs text-muted">CPU usage</p>
            <p class="tabular text-2xl font-bold text-highlighted">{{ snapshot.cpu.usagePercent }}%</p>
            <p class="text-xs text-muted">{{ snapshot.cpu.cores }} cores</p>
          </div>
          <div class="admin-kpi-card p-4">
            <p class="text-xs text-muted">Memory usage</p>
            <p class="tabular text-2xl font-bold text-highlighted">{{ snapshot.memory.usedPercent }}%</p>
            <p class="text-xs text-muted">{{ bytesToGb(snapshot.memory.usedBytes) }} / {{ bytesToGb(snapshot.memory.totalBytes) }} GB</p>
          </div>
          <div class="admin-kpi-card p-4">
            <p class="text-xs text-muted">Disk usage</p>
            <p class="tabular text-2xl font-bold text-highlighted">{{ snapshot.disks[0]?.usedPercent ?? '—' }}<span v-if="snapshot.disks[0]">%</span></p>
            <p class="text-xs text-muted">{{ snapshot.disks[0] ? `${bytesToGb(snapshot.disks[0].usedBytes ?? 0)} / ${bytesToGb(snapshot.disks[0].totalBytes ?? 0)} GB` : 'Unavailable' }}</p>
          </div>
          <div class="admin-kpi-card p-4">
            <p class="text-xs text-muted">Server uptime</p>
            <p class="tabular text-2xl font-bold text-highlighted">{{ fmtDuration(snapshot.serverUptimeSeconds) }}</p>
            <p class="text-xs text-muted">{{ snapshot.hostname }}</p>
          </div>
        </div>

        <!-- CPU + Memory detail -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="admin-kpi-card space-y-3 p-5">
            <h3 class="text-sm font-medium text-highlighted">CPU</h3>
            <div class="h-2 overflow-hidden rounded-full bg-[var(--color-admin-surface-tint)]">
              <div class="h-full rounded-full transition-all" :style="{ width: `${snapshot.cpu.usagePercent}%`, backgroundColor: barColor(snapshot.cpu.usagePercent) }" />
            </div>
            <dl class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
              <div><dt class="inline">Model:</dt> <dd class="inline text-highlighted">{{ snapshot.cpu.model }}</dd></div>
              <div><dt class="inline">Cores:</dt> <dd class="inline text-highlighted">{{ snapshot.cpu.cores }}</dd></div>
              <div><dt class="inline">Load (1m):</dt> <dd class="tabular inline text-highlighted">{{ snapshot.cpu.loadAvg1.toFixed(2) }}</dd></div>
              <div><dt class="inline">Load (5m):</dt> <dd class="tabular inline text-highlighted">{{ snapshot.cpu.loadAvg5.toFixed(2) }}</dd></div>
              <div><dt class="inline">Load (15m):</dt> <dd class="tabular inline text-highlighted">{{ snapshot.cpu.loadAvg15.toFixed(2) }}</dd></div>
            </dl>
          </div>

          <div class="admin-kpi-card space-y-3 p-5">
            <h3 class="text-sm font-medium text-highlighted">Memory</h3>
            <div class="h-2 overflow-hidden rounded-full bg-[var(--color-admin-surface-tint)]">
              <div class="h-full rounded-full transition-all" :style="{ width: `${snapshot.memory.usedPercent}%`, backgroundColor: barColor(snapshot.memory.usedPercent) }" />
            </div>
            <dl class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
              <div><dt class="inline">Total:</dt> <dd class="tabular inline text-highlighted">{{ bytesToGb(snapshot.memory.totalBytes) }} GB</dd></div>
              <div><dt class="inline">Used:</dt> <dd class="tabular inline text-highlighted">{{ bytesToGb(snapshot.memory.usedBytes) }} GB</dd></div>
              <div><dt class="inline">Free:</dt> <dd class="tabular inline text-highlighted">{{ bytesToGb(snapshot.memory.freeBytes) }} GB</dd></div>
              <div><dt class="inline">API process:</dt> <dd class="tabular inline text-highlighted">{{ bytesToMb(snapshot.apiProcessMemoryBytes) }} MB</dd></div>
            </dl>
          </div>
        </div>

        <!-- Disks -->
        <div v-if="snapshot.disks.length" class="admin-table-wrap">
          <div class="border-b border-[var(--color-admin-border)] p-4"><h3 class="text-sm font-medium text-muted">Disk usage</h3></div>
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Path</th>
                <th class="px-4 py-2.5 text-right">Used</th>
                <th class="px-4 py-2.5 text-right">Total</th>
                <th class="px-4 py-2.5 text-right">Usage</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in snapshot.disks" :key="d.path">
                <td class="px-4 py-3 font-mono text-xs">{{ d.path }}</td>
                <td class="tabular px-4 py-3 text-right">{{ d.usedBytes != null ? `${bytesToGb(d.usedBytes)} GB` : '—' }}</td>
                <td class="tabular px-4 py-3 text-right">{{ d.totalBytes != null ? `${bytesToGb(d.totalBytes)} GB` : '—' }}</td>
                <td class="px-4 py-3 text-right">
                  <span class="tabular font-medium" :style="{ color: d.usedPercent != null ? barColor(d.usedPercent) : undefined }">{{ d.usedPercent ?? '—' }}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PM2 Processes -->
        <div class="admin-table-wrap">
          <div class="border-b border-[var(--color-admin-border)] p-4"><h3 class="text-sm font-medium text-muted">Processes ({{ snapshot.pm2Processes.length }})</h3></div>
          <table v-if="snapshot.pm2Processes.length" class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Name</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">CPU</th>
                <th class="px-4 py-2.5 text-right">Memory</th>
                <th class="px-4 py-2.5 text-right">Uptime</th>
                <th class="px-4 py-2.5 text-right">Restarts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in snapshot.pm2Processes" :key="p.pmId">
                <td class="px-4 py-3 font-medium text-highlighted">{{ p.name }}</td>
                <td class="px-4 py-3"><UBadge :color="pm2StatusColor[p.status] ?? 'neutral'" variant="subtle">{{ p.status }}</UBadge></td>
                <td class="tabular px-4 py-3 text-right">{{ p.cpuPercent ?? '—' }}%</td>
                <td class="tabular px-4 py-3 text-right">{{ p.memoryBytes != null ? `${bytesToMb(p.memoryBytes)} MB` : '—' }}</td>
                <td class="tabular px-4 py-3 text-right">{{ p.uptimeMs != null ? fmtDuration(p.uptimeMs / 1000) : '—' }}</td>
                <td class="tabular px-4 py-3 text-right">{{ p.restarts ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-4 py-12 text-center text-sm text-muted">Not running under PM2 — no process data available (expected in local dev).</p>
        </div>

        <!-- Dependencies -->
        <div class="admin-table-wrap">
          <div class="border-b border-[var(--color-admin-border)] p-4"><h3 class="text-sm font-medium text-muted">Dependencies</h3></div>
          <div class="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div v-for="dep in snapshot.dependencies" :key="dep.name" class="flex items-center justify-between rounded-lg border border-[var(--color-admin-border)] p-3">
              <div class="flex items-center gap-2">
                <UIcon :name="dep.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" :class="dep.ok ? 'text-success' : 'text-error'" class="size-4" />
                <span class="font-medium text-highlighted">{{ dep.name }}</span>
              </div>
              <span class="tabular text-sm text-muted">{{ dep.ok ? fmtMs(dep.latencyMs) : dep.error }}</span>
            </div>
          </div>
        </div>

        <p class="text-right text-xs text-muted">Last updated {{ new Date(snapshot.timestamp).toLocaleTimeString() }}</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
