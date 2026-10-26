import { z } from 'zod'

// Session replay of funnel pages (rrweb). The funnel page records DOM events (inputs are masked in the
// browser, never sent), ships them in small chunks, and the admin replays them as a video-like player.

// Hard caps, enforced by the API so a rogue client cannot fill the database.
export const RECORDING_MAX_CHUNK_EVENTS = 3000
export const RECORDING_MAX_CHUNKS = 400
export const RECORDING_MAX_BYTES = 4 * 1024 * 1024
export const RECORDING_RETENTION_DAYS = 14

// One rrweb event: a numeric `type`, a millisecond `timestamp` and a `data` payload we do not inspect.
const RecordingEventSchema = z.object({ type: z.number().int(), timestamp: z.number() }).passthrough()

export const RecordingChunkSchema = z.object({
  viewId: z.uuid(),
  visitorId: z.string().min(8).max(100),
  // 0 for the first chunk (it carries the full page snapshot), then 1, 2, …
  seq: z.number().int().min(0).max(RECORDING_MAX_CHUNKS),
  events: z.array(RecordingEventSchema).min(1).max(RECORDING_MAX_CHUNK_EVENTS)
})
export type RecordingChunk = z.infer<typeof RecordingChunkSchema>

export const FunnelRecordingSummarySchema = z.object({
  viewId: z.string(),
  startedAt: z.string(),
  deviceType: z.string().nullable(),
  source: z.string().nullable(),
  campaign: z.string().nullable(),
  // From the page view's engagement report (visible seconds, deepest scroll %, order form touched).
  durationSeconds: z.number().int().nullable(),
  scrollDepth: z.number().int().nullable(),
  startedForm: z.boolean(),
  // Wall-clock length of the recording itself.
  recordedMs: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative()
})
export type FunnelRecordingSummary = z.infer<typeof FunnelRecordingSummarySchema>

export const FunnelRecordingListSchema = z.object({
  items: z.array(FunnelRecordingSummarySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  pageSize: z.number().int()
})
export type FunnelRecordingList = z.infer<typeof FunnelRecordingListSchema>

export const FunnelRecordingDetailSchema = z.object({
  summary: FunnelRecordingSummarySchema,
  // rrweb events in order, ready for the player.
  events: z.array(z.record(z.string(), z.unknown()))
})
export type FunnelRecordingDetail = z.infer<typeof FunnelRecordingDetailSchema>
