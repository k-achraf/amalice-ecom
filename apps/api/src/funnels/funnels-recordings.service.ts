import { Injectable, NotFoundException } from '@nestjs/common'
import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_CHUNKS,
  RECORDING_RETENTION_DAYS,
  type FunnelRecordingDetail,
  type FunnelRecordingList,
  type FunnelRecordingSummary,
  type RecordingChunk
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

const PAGE_SIZE = 25
// One in this many new recordings also purges expired ones (no scheduler needed for a cleanup this small).
const PURGE_ONE_IN = 40

interface ViewInfo {
  durationSeconds: number | null
  scrollDepth: number | null
  startedForm: boolean
  deviceType: string | null
  source: string | null
  campaign: string | null
}

// Session replay: the funnel page ships rrweb events in chunks, the admin replays them.
@Injectable()
export class FunnelsRecordingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public write. Only accepted for a real funnel visit (the page view the page itself reported first,
  // same visitor), capped in size and chunk count. Re-sent chunks are ignored, so retries are safe.
  async ingest(chunk: RecordingChunk): Promise<void> {
    const view = await this.prisma.pageViewEvent.findFirst({
      where: { id: chunk.viewId, visitorId: chunk.visitorId, type: 'Funnel', entityId: { not: null } },
      select: { entityId: true }
    })
    if (!view?.entityId) return

    const size = JSON.stringify(chunk.events).length
    const times = chunk.events.map((e) => e.timestamp).filter((t) => Number.isFinite(t))
    const first = new Date(Math.min(...times, Date.now()))
    const last = new Date(Math.min(Math.max(...times, first.getTime()), Date.now() + 60_000))

    const existing = await this.prisma.funnelRecording.findUnique({ where: { id: chunk.viewId }, select: { bytes: true } })
    if (existing) {
      if (existing.bytes + size > RECORDING_MAX_BYTES || chunk.seq > RECORDING_MAX_CHUNKS) return
    } else {
      // Only a first chunk (full snapshot) can start a recording: a stray later chunk has nothing to play.
      if (chunk.seq !== 0) return
      await this.prisma.funnelRecording
        .create({ data: { id: chunk.viewId, funnelId: view.entityId, visitorId: chunk.visitorId, startedAt: first, endedAt: last } })
        .catch(() => undefined) // lost a race with a parallel first chunk: it exists now
      if (Math.floor(Math.random() * PURGE_ONE_IN) === 0) void this.purgeExpired().catch(() => undefined)
    }

    const stored = await this.prisma.funnelRecordingChunk.createMany({
      data: [{ recordingId: chunk.viewId, seq: chunk.seq, events: chunk.events as object[] }],
      skipDuplicates: true
    })
    if (stored.count === 0) return
    await this.prisma.funnelRecording.update({
      where: { id: chunk.viewId },
      data: { eventCount: { increment: chunk.events.length }, bytes: { increment: size }, endedAt: last }
    })
  }

  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const r = await this.prisma.funnelRecording.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return r.count
  }

  async list(funnelId: string, page: number): Promise<FunnelRecordingList> {
    const where = { funnelId, eventCount: { gt: 1 } }
    const [total, rows] = await Promise.all([
      this.prisma.funnelRecording.count({ where }),
      this.prisma.funnelRecording.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, startedAt: true, endedAt: true, eventCount: true }
      })
    ])
    const views = await this.viewsOf(rows.map((r) => r.id))
    return {
      items: rows.map((r) => this.summary(r, views.get(r.id))),
      total,
      page,
      pageSize: PAGE_SIZE
    }
  }

  async get(funnelId: string, viewId: string): Promise<FunnelRecordingDetail> {
    const rec = await this.prisma.funnelRecording.findFirst({
      where: { id: viewId, funnelId },
      select: { id: true, startedAt: true, endedAt: true, eventCount: true, chunks: { orderBy: { seq: 'asc' }, select: { events: true } } }
    })
    if (!rec) throw new NotFoundException('Recording not found')
    const views = await this.viewsOf([rec.id])
    return {
      summary: this.summary(rec, views.get(rec.id)),
      events: rec.chunks.flatMap((c) => c.events as Record<string, unknown>[])
    }
  }

  async remove(funnelId: string, viewId: string): Promise<void> {
    await this.prisma.funnelRecording.deleteMany({ where: { id: viewId, funnelId } })
  }

  private async viewsOf(ids: string[]): Promise<Map<string, ViewInfo>> {
    if (ids.length === 0) return new Map()
    const rows = await this.prisma.pageViewEvent.findMany({
      where: { id: { in: ids } },
      select: { id: true, durationSeconds: true, scrollDepth: true, startedForm: true, deviceType: true, source: true, campaign: true }
    })
    return new Map(rows.map((r) => [r.id, r]))
  }

  private summary(r: { id: string; startedAt: Date; endedAt: Date; eventCount: number }, v?: ViewInfo): FunnelRecordingSummary {
    return {
      viewId: r.id,
      startedAt: r.startedAt.toISOString(),
      deviceType: v?.deviceType ?? null,
      source: v?.source ?? null,
      campaign: v?.campaign ?? null,
      durationSeconds: v?.durationSeconds ?? null,
      scrollDepth: v?.scrollDepth ?? null,
      startedForm: v?.startedForm ?? false,
      recordedMs: Math.max(0, r.endedAt.getTime() - r.startedAt.getTime()),
      eventCount: r.eventCount
    }
  }
}
