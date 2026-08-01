// Admin "Server Performance" page — a live snapshot of the VPS's own
// resource usage (CPU/memory/disk) plus each PM2-managed process and the
// Postgres/Redis dependencies. Read-only; no persistence — every request
// samples fresh (see ServerPerformanceService for how CPU % is sampled).

export interface ServerPerformanceCpu {
  cores: number
  model: string
  // Standard Unix load averages — not meaningful on Windows (always 0s
  // there), but this app only ever runs production on Linux.
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
  // Aggregate usage across all cores, sampled over a short window at
  // request time (see ServerPerformanceService.sampleCpuUsagePercent) —
  // load average alone doesn't tell you "how busy is the CPU right now."
  usagePercent: number
}

export interface ServerPerformanceMemory {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
}

export interface ServerPerformanceDisk {
  // Mount point/path this entry describes — the app's own working
  // directory's filesystem, not necessarily "/".
  path: string
  // Null when disk stats couldn't be read (e.g. `df` unavailable — expected
  // on a non-Linux dev machine, not expected in production).
  totalBytes: number | null
  usedBytes: number | null
  freeBytes: number | null
  usedPercent: number | null
}

export interface ServerPerformanceProcess {
  name: string
  pmId: number
  status: string
  cpuPercent: number | null
  memoryBytes: number | null
  uptimeMs: number | null
  restarts: number | null
}

export interface ServerPerformanceDependency {
  name: string
  ok: boolean
  latencyMs: number | null
  error: string | null
}

export interface ServerPerformanceSnapshot {
  hostname: string
  platform: string
  nodeVersion: string
  // Host OS uptime — distinct from apiProcessUptimeSeconds below (this
  // Node process's own uptime, which resets on every deploy/restart).
  serverUptimeSeconds: number
  apiProcessUptimeSeconds: number
  apiProcessMemoryBytes: number
  cpu: ServerPerformanceCpu
  memory: ServerPerformanceMemory
  disks: ServerPerformanceDisk[]
  // Empty array (not an error) when PM2 isn't available — e.g. running via
  // `node dist/main.js` directly in local dev instead of through PM2.
  pm2Processes: ServerPerformanceProcess[]
  dependencies: ServerPerformanceDependency[]
  timestamp: string
}
