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
  if (percent >= 90) return 'var(--danger)'
  if (percent >= 70) return 'var(--brass)'
  return 'var(--teal)'
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
  <AdsPage title="Server performance" description="Live health of the API host">
    <template #actions>
      <label style="display: flex; align-items: center; gap: 10px">
        <span class="muted">Auto-refresh</span>
        <AdsSwitch v-model="autoRefresh" />
      </label>
      <button class="btn" type="button" :disabled="loading" @click="manualRefresh"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </template>

    <div v-if="loading && !snapshot" class="empty">Loading…</div>
    <div v-else-if="errorMessage && !snapshot" class="empty" style="color: var(--danger-fg)">{{ errorMessage }}</div>
    <template v-else-if="snapshot">
      <p v-if="errorMessage" class="notice" style="background: var(--danger-bg); color: var(--danger-fg)">{{ errorMessage }} — showing last successful snapshot.</p>

      <!-- KPI row -->
      <section class="kpis" aria-label="Server summary">
        <AdsKpiCard label="CPU usage" :value="`${snapshot.cpu.usagePercent}%`" :meta="`${snapshot.cpu.cores} cores`" />
        <AdsKpiCard label="Memory usage" :value="`${snapshot.memory.usedPercent}%`" :meta="`${bytesToGb(snapshot.memory.usedBytes)} / ${bytesToGb(snapshot.memory.totalBytes)} GB`" />
        <AdsKpiCard label="Disk usage" :value="snapshot.disks[0] ? `${snapshot.disks[0].usedPercent ?? '—'}%` : '—'" :meta="snapshot.disks[0] ? `${bytesToGb(snapshot.disks[0].usedBytes ?? 0)} / ${bytesToGb(snapshot.disks[0].totalBytes ?? 0)} GB` : 'Unavailable'" />
        <AdsKpiCard label="Server uptime" :value="fmtDuration(snapshot.serverUptimeSeconds)" color="dark" :meta="snapshot.hostname" />
      </section>

      <!-- CPU + Memory detail -->
      <div class="row">
        <section class="card" style="flex: 1 1 340px">
          <div class="card-head"><h2>CPU</h2></div>
          <div class="track"><div :style="{ width: `${snapshot.cpu.usagePercent}%`, background: barColor(snapshot.cpu.usagePercent) }" /></div>
          <div class="mini-stats">
            <div><span class="muted">Model</span><b style="font-size: 14px">{{ snapshot.cpu.model }}</b></div>
            <div><span class="muted">Cores</span><b>{{ snapshot.cpu.cores }}</b></div>
            <div><span class="muted">Load (1m)</span><b>{{ snapshot.cpu.loadAvg1.toFixed(2) }}</b></div>
            <div><span class="muted">Load (5m)</span><b>{{ snapshot.cpu.loadAvg5.toFixed(2) }}</b></div>
            <div><span class="muted">Load (15m)</span><b>{{ snapshot.cpu.loadAvg15.toFixed(2) }}</b></div>
          </div>
        </section>

        <section class="card" style="flex: 1 1 340px">
          <div class="card-head"><h2>Memory</h2></div>
          <div class="track"><div :style="{ width: `${snapshot.memory.usedPercent}%`, background: barColor(snapshot.memory.usedPercent) }" /></div>
          <div class="mini-stats">
            <div><span class="muted">Total</span><b>{{ bytesToGb(snapshot.memory.totalBytes) }} GB</b></div>
            <div><span class="muted">Used</span><b>{{ bytesToGb(snapshot.memory.usedBytes) }} GB</b></div>
            <div><span class="muted">Free</span><b>{{ bytesToGb(snapshot.memory.freeBytes) }} GB</b></div>
            <div><span class="muted">API process</span><b>{{ bytesToMb(snapshot.apiProcessMemoryBytes) }} MB</b></div>
          </div>
        </section>
      </div>

      <!-- Disks -->
      <section v-if="snapshot.disks.length" class="card" aria-label="Disk usage">
        <div class="card-head"><h2>Disk usage</h2></div>
        <div class="table-wrap">
          <table style="min-width: 520px">
            <thead><tr><th>Path</th><th class="num">Used</th><th class="num">Total</th><th class="num">Usage</th></tr></thead>
            <tbody>
              <tr v-for="d in snapshot.disks" :key="d.path">
                <td class="mono">{{ d.path }}</td>
                <td class="num">{{ d.usedBytes != null ? `${bytesToGb(d.usedBytes)} GB` : '—' }}</td>
                <td class="num">{{ d.totalBytes != null ? `${bytesToGb(d.totalBytes)} GB` : '—' }}</td>
                <td class="num strong" :style="{ color: d.usedPercent != null ? barColor(d.usedPercent) : undefined }">{{ d.usedPercent ?? '—' }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- PM2 Processes -->
      <section class="card" aria-label="Processes">
        <div class="card-head"><h2>Processes <small>{{ snapshot.pm2Processes.length }}</small></h2></div>
        <div v-if="snapshot.pm2Processes.length" class="table-wrap">
          <table style="min-width: 640px">
            <thead><tr><th>Name</th><th>Status</th><th class="num">CPU</th><th class="num">Memory</th><th class="num">Uptime</th><th class="num">Restarts</th></tr></thead>
            <tbody>
              <tr v-for="p in snapshot.pm2Processes" :key="p.pmId">
                <td class="strong">{{ p.name }}</td>
                <td><AdsBadge :color="pm2StatusColor[p.status] ?? 'neutral'" variant="subtle">{{ p.status }}</AdsBadge></td>
                <td class="num">{{ p.cpuPercent ?? '—' }}%</td>
                <td class="num">{{ p.memoryBytes != null ? `${bytesToMb(p.memoryBytes)} MB` : '—' }}</td>
                <td class="num">{{ p.uptimeMs != null ? fmtDuration(p.uptimeMs / 1000) : '—' }}</td>
                <td class="num">{{ p.restarts ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty">Not running under PM2 — no process data available (expected in local dev).</p>
      </section>

      <!-- Dependencies -->
      <section class="card" aria-label="Dependencies">
        <div class="card-head"><h2>Dependencies</h2></div>
        <ul class="list">
          <li v-for="dep in snapshot.dependencies" :key="dep.name">
            <AdsIcon :name="dep.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" style="width: 18px; height: 18px" :style="{ color: dep.ok ? 'var(--teal)' : 'var(--danger)' }" />
            <span class="grow strong">{{ dep.name }}</span>
            <span class="muted">{{ dep.ok ? fmtMs(dep.latencyMs) : dep.error }}</span>
          </li>
        </ul>
      </section>

      <p class="muted" style="text-align: right">Last updated {{ new Date(snapshot.timestamp).toLocaleTimeString() }}</p>
    </template>
  </AdsPage>
</template>
