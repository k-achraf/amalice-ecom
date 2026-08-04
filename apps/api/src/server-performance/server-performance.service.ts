import { Injectable, Logger } from '@nestjs/common'
import * as os from 'node:os'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { ServerLogLevel, ServerLogResponse, ServerPerformanceDependency, ServerPerformanceDisk, ServerPerformanceProcess, ServerPerformanceSnapshot } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import type { Prisma } from '../generated/prisma/client'

const execAsync = promisify(exec)

@Injectable()
export class ServerPerformanceService {
  private readonly logger = new Logger(ServerPerformanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  // os.cpus() gives cumulative tick counts since boot, not instantaneous
  // usage — the standard way to get a "% busy right now" number is to
  // sample twice a short interval apart and diff. 200ms is enough to get a
  // stable read without making this endpoint noticeably slow.
  private async sampleCpuUsagePercent(): Promise<number> {
    const start = os.cpus()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const end = os.cpus()

    let idleDelta = 0
    let totalDelta = 0
    for (let i = 0; i < start.length; i++) {
      const s = start[i]!.times
      const e = end[i]!.times
      const sIdle = s.idle
      const eIdle = e.idle
      const sTotal = s.user + s.nice + s.sys + s.idle + s.irq
      const eTotal = e.user + e.nice + e.sys + e.idle + e.irq
      idleDelta += eIdle - sIdle
      totalDelta += eTotal - sTotal
    }
    if (totalDelta <= 0) return 0
    return Math.round((1 - idleDelta / totalDelta) * 1000) / 10
  }

  // `df` is POSIX/Linux — this app only runs production on a Linux VPS, but
  // a local Windows dev machine would fail this shell-out, so it's wrapped
  // and returns an empty array rather than throwing (see disks' Prisma-style
  // "empty array, not an error" comment on the shared type).
  private async readDiskUsage(): Promise<ServerPerformanceDisk[]> {
    if (process.platform !== 'linux') return []
    try {
      // -k forces 1024-byte blocks (portable across df implementations),
      // -P forces POSIX single-line-per-entry output.
      const { stdout } = await execAsync(`df -kP "${process.cwd()}"`)
      const lines = stdout.trim().split('\n')
      const dataLine = lines[1]
      if (!dataLine) return []
      const parts = dataLine.trim().split(/\s+/)
      const totalKb = Number(parts[1])
      const usedKb = Number(parts[2])
      const availKb = Number(parts[3])
      const mount = parts[5] ?? process.cwd()
      if (!Number.isFinite(totalKb) || totalKb <= 0) return []
      return [
        {
          path: mount,
          totalBytes: totalKb * 1024,
          usedBytes: usedKb * 1024,
          freeBytes: availKb * 1024,
          usedPercent: Math.round((usedKb / totalKb) * 1000) / 10
        }
      ]
    } catch (error) {
      this.logger.warn(`Failed to read disk usage: ${(error as Error).message}`)
      return []
    }
  }

  // PM2 process list — empty (not an error) when this API isn't running
  // under PM2 (e.g. local `node dist/main.js` in dev).
  private async readPm2Processes(): Promise<ServerPerformanceProcess[]> {
    try {
      const { stdout } = await execAsync('pm2 jlist')
      const list = JSON.parse(stdout) as Array<{
        name: string
        pm_id: number
        pm2_env: { status: string; pm_uptime: number; restart_time: number }
        monit: { cpu: number; memory: number }
      }>
      return list.map((p) => ({
        name: p.name,
        pmId: p.pm_id,
        status: p.pm2_env.status,
        cpuPercent: p.monit?.cpu ?? null,
        memoryBytes: p.monit?.memory ?? null,
        uptimeMs: p.pm2_env.status === 'online' ? Date.now() - p.pm2_env.pm_uptime : null,
        restarts: p.pm2_env.restart_time ?? null
      }))
    } catch {
      // PM2 not installed/on PATH, or this process isn't managed by it —
      // both expected outside production.
      return []
    }
  }

  private async checkDependencies(): Promise<ServerPerformanceDependency[]> {
    const results: ServerPerformanceDependency[] = []

    const dbStart = Date.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
      results.push({ name: 'Postgres', ok: true, latencyMs: Date.now() - dbStart, error: null })
    } catch (error) {
      results.push({ name: 'Postgres', ok: false, latencyMs: null, error: (error as Error).message })
    }

    const redisStart = Date.now()
    try {
      await this.redis.ping()
      results.push({ name: 'Redis', ok: true, latencyMs: Date.now() - redisStart, error: null })
    } catch (error) {
      results.push({ name: 'Redis', ok: false, latencyMs: null, error: (error as Error).message })
    }

    return results
  }

  async getSnapshot(): Promise<ServerPerformanceSnapshot> {
    const [usagePercent, disks, pm2Processes, dependencies] = await Promise.all([
      this.sampleCpuUsagePercent(),
      this.readDiskUsage(),
      this.readPm2Processes(),
      this.checkDependencies()
    ])

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const cpus = os.cpus()
    const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg()

    return {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      serverUptimeSeconds: os.uptime(),
      apiProcessUptimeSeconds: process.uptime(),
      apiProcessMemoryBytes: process.memoryUsage().rss,
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model ?? 'unknown',
        loadAvg1,
        loadAvg5,
        loadAvg15,
        usagePercent
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: usedMem,
        usedPercent: Math.round((usedMem / totalMem) * 1000) / 10
      },
      disks,
      pm2Processes,
      dependencies,
      timestamp: new Date().toISOString()
    }
  }

  // Backs the admin "Server Logs" page — every `Logger.warn()`/`.error()`
  // call anywhere in the API, captured by PersistentLogger (see common/).
  // Distinct from AuditLog (business events): this is operational noise
  // ops staff would otherwise only see via SSH + `pm2 logs`.
  async listLogs(args: { level?: ServerLogLevel; search?: string; page: number; pageSize: number }): Promise<ServerLogResponse> {
    const where: Prisma.ServerLogWhereInput = {
      ...(args.level && { level: args.level }),
      ...(args.search && {
        OR: [{ message: { contains: args.search, mode: 'insensitive' } }, { context: { contains: args.search, mode: 'insensitive' } }]
      })
    }
    const [rows, total] = await Promise.all([
      this.prisma.serverLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.serverLog.count({ where })
    ])

    return {
      items: rows.map((row) => ({
        id: row.id,
        level: row.level,
        context: row.context,
        message: row.message,
        trace: row.trace,
        createdAt: row.createdAt.toISOString()
      })),
      total,
      page: args.page,
      pageSize: args.pageSize
    }
  }
}
