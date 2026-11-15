import { z } from 'zod'
import { OrderState } from '@amalice/shared'
import { type ToolContext, safe } from './util.js'

export function registerOrderTools({ server, api }: ToolContext) {
  server.registerTool(
    'list_orders',
    {
      title: 'List orders',
      description:
        'List COD orders, newest first, with filters. Amounts in the filters minTotal/maxTotal are in DA (dinars); amounts in results are in cents. Use `search` for a phone, name or order reference.',
      inputSchema: {
        state: OrderState.optional().describe('Only orders in this state'),
        search: z.string().optional().describe('Phone, customer name or order reference'),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        productId: z.string().optional(),
        funnelId: z.string().optional().describe("A funnel id, or 'none' for orders not placed through a funnel"),
        companyId: z.string().optional().describe('Shipping company id the order is assigned to'),
        region: z.string().optional().describe('Delivery wilaya name'),
        city: z.string().optional().describe('Delivery commune name'),
        platform: z.enum(['Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct']).optional().describe('Ad source'),
        riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
        minTotal: z.number().nonnegative().optional(),
        maxTotal: z.number().nonnegative().optional(),
        from: z.string().optional().describe('Created on/after (ISO date)'),
        to: z.string().optional().describe('Created on/before (ISO date)'),
        hasTracking: z.enum(['yes', 'no']).optional(),
        archived: z.enum(['only', 'exclude']).optional(),
        abandoned: z.enum(['only', 'exclude']).optional().describe('Abandoned checkouts (leads) only / excluded')
      },
      annotations: { readOnlyHint: true }
    },
    safe((q) => api.get('/admin/orders', q))
  )

  server.registerTool(
    'get_order',
    {
      title: 'Get order',
      description: 'Full detail of one order: customer, address, items, totals, shipment, risk, attribution.',
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ orderId }) => api.get(`/admin/orders/${orderId}`))
  )

  server.registerTool(
    'get_order_full',
    {
      title: 'Get order — everything in the database',
      description:
        "EVERYTHING stored about one order, for analysis: the full order (customer, address, items, totals, shipment, risk score + factors, cash reconciliation, notifications), the complete attribution/device footprint (IP address, user agent, device type, visitorId = the browser's persisted device id, fbp/fbc/ttp cookies, click ids, UTM/campaign/ad ids, landing URL, referrer, first touch), call attempts, the audit trail, courier events, the visitor's page views and funnel session recordings, funnel-protection refusals from the same IP/phone, the customer's addresses, and every other order sharing the customer / IP / visitor id / user agent (duplicate or fraud-ring signals). Note: no canvas/hardware fingerprint is stored; visitorId + userAgent + IP are the device identity. Amounts in cents.",
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ orderId }) => api.get(`/admin/orders/${orderId}/full`))
  )

  server.registerTool(
    'list_orders_full',
    {
      title: 'List orders with full details',
      description:
        'Same filters as list_orders, but returns the get_order_full profile (IP, user agent, visitor id, page views, call attempts, audit, related orders…) for every order on the page. Max 10 per page; use it to analyse a batch (e.g. all High-risk orders of a funnel, or all orders from one IP).',
      inputSchema: {
        state: OrderState.optional(),
        search: z.string().optional().describe('Phone, customer name or order reference'),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(10).default(5),
        productId: z.string().optional(),
        funnelId: z.string().optional().describe("A funnel id, or 'none'"),
        companyId: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        platform: z.enum(['Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct']).optional(),
        riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        archived: z.enum(['only', 'exclude']).optional(),
        abandoned: z.enum(['only', 'exclude']).optional()
      },
      annotations: { readOnlyHint: true }
    },
    safe(async (q) => {
      const list = await api.get<{ items: { id: string }[]; total: number; page: number; pageSize: number }>('/admin/orders', q)
      const profiles = await Promise.all(list.items.map((o) => api.get(`/admin/orders/${o.id}/full`)))
      return { total: list.total, page: list.page, pageSize: list.pageSize, orders: profiles }
    })
  )

  server.registerTool(
    'get_order_timeline',
    {
      title: 'Order timeline',
      description: 'Chronological history of an order: status changes, edits, call attempts, shipping events, notifications.',
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ orderId }) => api.get(`/admin/orders/${orderId}/timeline`))
  )

  server.registerTool(
    'get_order_calls',
    {
      title: 'Order call attempts',
      description: "The call-center attempts logged on an order and the customer's order history.",
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(async ({ orderId }) => ({
      calls: await api.get(`/admin/orders/${orderId}/calls`),
      customerHistory: await api.get(`/admin/orders/${orderId}/customer-history`)
    }))
  )

  server.registerTool(
    'transition_order',
    {
      title: 'Change order state',
      description:
        'Move an order to a new state (e.g. Confirmed, Cancelled, Packed). The API enforces the legal state machine and rejects invalid moves. For Postponed, postponedUntil (ISO datetime) is required.',
      inputSchema: {
        orderId: z.string(),
        to: OrderState,
        postponedUntil: z.string().datetime().optional()
      },
      annotations: { idempotentHint: true }
    },
    safe(({ orderId, to, postponedUntil }) => api.post(`/admin/orders/${orderId}/transition`, { to, postponedUntil }))
  )

  server.registerTool(
    'bulk_transition_orders',
    {
      title: 'Change state of many orders',
      description:
        'Move up to 200 orders to one state. Returns which moved and which failed (with the reason). Prefer this over many single calls.',
      inputSchema: {
        orderIds: z.array(z.string()).min(1).max(200),
        to: OrderState,
        postponedUntil: z.string().datetime().optional()
      }
    },
    safe((body) => api.post('/admin/orders/bulk-transition', body))
  )

  server.registerTool(
    'set_order_notes',
    {
      title: 'Set order notes',
      description:
        'Replace the free-text call-center notes on an order (pass null to clear). Read the current notes with get_order first if you need to append.',
      inputSchema: { orderId: z.string(), notes: z.string().max(2000).nullable() },
      annotations: { idempotentHint: true }
    },
    safe(({ orderId, notes }) => api.patch(`/admin/orders/${orderId}/notes`, { notes }))
  )
}
