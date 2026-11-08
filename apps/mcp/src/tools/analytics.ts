import { z } from 'zod'
import { type ToolContext, safe } from './util.js'

const days = (def: number, max = 365) => z.number().int().min(1).max(max).default(def)

type RrwebEvent = Record<string, any>

// rrweb events are far too big to hand to a model: boil a recording down to
// what happened (pages, clicks, form activity, scroll) instead.
function summarizeRecording(events: RrwebEvent[]) {
  let clicks = 0
  let inputs = 0
  let scrolls = 0
  const pages: string[] = []
  const clickTargets: Record<string, number> = {}
  for (const e of events) {
    if (e.type === 4 && typeof e.data?.href === 'string' && pages[pages.length - 1] !== e.data.href) pages.push(e.data.href)
    if (e.type === 3) {
      const src = e.data?.source
      if (src === 2 && e.data?.type === 2) {
        clicks++
        const k = String(e.data?.id)
        clickTargets[k] = (clickTargets[k] ?? 0) + 1
      } else if (src === 5) inputs++
      else if (src === 3) scrolls++
    }
  }
  const first = events[0]?.timestamp as number | undefined
  const last = events[events.length - 1]?.timestamp as number | undefined
  return {
    eventCount: events.length,
    durationSeconds: first && last ? Math.round((last - first) / 1000) : null,
    pages,
    clicks,
    formInputs: inputs,
    scrollEvents: scrolls,
    mostClickedElementIds: Object.entries(clickTargets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ id, clicks: n }))
  }
}

export function registerAnalyticsTools({ server, api }: ToolContext) {
  server.registerTool(
    'get_dashboard_stats',
    {
      title: 'Dashboard stats',
      description: 'Business headline numbers: orders by state, revenue, conversion, etc. (the admin home dashboard).',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(() => api.get('/admin/stats'))
  )

  server.registerTool(
    'get_traffic_overview',
    {
      title: 'Site traffic overview',
      description:
        'Storefront traffic for the last N days: total views, unique visitors, home/product/landing-page views, top products and landing pages.',
      inputSchema: { days: days(7, 90) },
      annotations: { readOnlyHint: true }
    },
    safe(({ days }) => api.get('/admin/analytics/overview', { days }))
  )

  server.registerTool(
    'list_visitors',
    {
      title: 'List visitors',
      description:
        "Visitors seen in the last N days (most recent first) with pages viewed, first/last seen, device, traffic source/campaign, and best time-on-page/scroll. Use get_visitor for one visitor's journey.",
      inputSchema: {
        days: days(7, 90),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        source: z.string().optional().describe('Traffic source, e.g. Meta, TikTok, Organic, Direct'),
        type: z.enum(['Home', 'Product', 'LandingPage', 'Funnel', 'Other']).optional().describe('Only visitors who viewed this kind of page')
      },
      annotations: { readOnlyHint: true }
    },
    safe((q) => api.get('/admin/analytics/visitors', q))
  )

  server.registerTool(
    'get_visitor',
    {
      title: 'Visitor journey',
      description:
        "One visitor's full session history: every page view in order (with duration/scroll/form), their funnel session recordings and any orders they placed.",
      inputSchema: { visitorId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ visitorId }) => api.get(`/admin/analytics/visitors/${encodeURIComponent(visitorId)}`))
  )

  server.registerTool(
    'list_funnels',
    {
      title: 'List funnels',
      description: 'All funnels with status, product and slug.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(() => api.get('/admin/funnels'))
  )

  server.registerTool(
    'get_funnel',
    {
      title: 'Get funnel',
      description: 'One funnel with its ordered steps (landing, order form, bump, upsell, thank-you).',
      inputSchema: { funnelId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ funnelId }) => api.get(`/admin/funnels/${funnelId}`))
  )

  server.registerTool(
    'get_funnel_stats',
    {
      title: 'Funnel stats',
      description:
        'Per-funnel performance over the last N days: visits, engagement, device/source breakdown, orders and conversion per step.',
      inputSchema: { funnelId: z.string(), days: days(30) },
      annotations: { readOnlyHint: true }
    },
    safe(({ funnelId, days }) => api.get(`/admin/funnels/${funnelId}/stats`, { days }))
  )

  server.registerTool(
    'get_funnel_next_test',
    {
      title: 'Funnel: next A/B test',
      description: 'Rule-based suggestion for which test to run next on a funnel (needs ~100 visitors of data).',
      inputSchema: { funnelId: z.string(), days: days(30) },
      annotations: { readOnlyHint: true }
    },
    safe(({ funnelId, days }) => api.get(`/admin/funnels/${funnelId}/next-test`, { days }))
  )

  server.registerTool(
    'list_funnel_sessions',
    {
      title: 'Funnel sessions (recordings)',
      description:
        'Recorded visitor sessions of a funnel, newest first: device, source, duration, scroll, whether they started the form. Use get_funnel_session for what a visitor did.',
      inputSchema: { funnelId: z.string(), page: z.number().int().positive().default(1) },
      annotations: { readOnlyHint: true }
    },
    safe(({ funnelId, page }) => api.get(`/admin/funnels/${funnelId}/recordings`, { page }))
  )

  server.registerTool(
    'get_funnel_session',
    {
      title: 'Funnel session summary',
      description:
        'What one recorded session did: pages visited, clicks, form inputs, scrolling and duration. Returns a digest, not the raw replay (set raw=true for the first 300 raw rrweb events).',
      inputSchema: {
        funnelId: z.string(),
        sessionId: z.string().describe('The viewId from list_funnel_sessions'),
        raw: z.boolean().default(false)
      },
      annotations: { readOnlyHint: true }
    },
    safe(async ({ funnelId, sessionId, raw }) => {
      const rec = await api.get<{ summary: unknown; events: RrwebEvent[] }>(`/admin/funnels/${funnelId}/recordings/${sessionId}`)
      return {
        summary: rec.summary,
        digest: summarizeRecording(rec.events),
        ...(raw ? { events: rec.events.slice(0, 300) } : {})
      }
    })
  )

  server.registerTool(
    'update_funnel',
    {
      title: 'Update funnel',
      description: 'Change a funnel: name, status (Draft | Live | Paused), slug, pixels (pixelIds = ids of the named pixels created in Apps → Pixels). Setting Live publishes it to the funnels site.',
      inputSchema: {
        funnelId: z.string(),
        name: z.string().optional(),
        status: z.enum(['Draft', 'Live', 'Paused']).optional(),
        slug: z.string().optional(),
        pixelIds: z.array(z.string()).optional()
      }
    },
    safe(({ funnelId, ...body }) => api.patch(`/admin/funnels/${funnelId}`, body))
  )
}
