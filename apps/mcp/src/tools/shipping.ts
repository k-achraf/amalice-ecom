import { z } from 'zod'
import { type ToolContext, safe } from './util.js'

export function registerShippingTools({ server, api }: ToolContext) {
  server.registerTool(
    'list_shipping_companies',
    {
      title: 'Shipping companies',
      description: 'Linked courier companies (DHD, Swift Express, Anderson, 48 Hr...) with their ids and status. Needed to assign an order.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(() => api.get('/admin/shipping-companies'))
  )

  server.registerTool(
    'get_shipping_rates',
    {
      title: 'Shipping rates',
      description: 'Per-wilaya home/desk delivery prices charged to customers.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(() => api.get('/admin/shipping/rates'))
  )

  server.registerTool(
    'list_deliveries',
    {
      title: 'Deliveries',
      description: 'Orders in the delivery pipeline (handed to courier, out for delivery, failed...).',
      inputSchema: {
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        state: z.string().optional()
      },
      annotations: { readOnlyHint: true }
    },
    safe((q) => api.get('/admin/deliveries', q))
  )

  server.registerTool(
    'get_order_tracking',
    {
      title: 'Order tracking',
      description: "Live courier tracking for an order's shipment (one call to the courier).",
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ orderId }) => api.get(`/admin/fulfillment/orders/${orderId}/tracking`))
  )

  server.registerTool(
    'check_order_address',
    {
      title: 'Check delivery address',
      description: "Validates the order's wilaya/commune against the assigned courier's coverage before dispatch.",
      inputSchema: { orderId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ orderId }) => api.get(`/admin/fulfillment/orders/${orderId}/address-check`))
  )

  server.registerTool(
    'assign_shipping_company',
    {
      title: 'Assign courier',
      description: 'Assign a shipping company to an order. Required before dispatch; dispatch never falls back to a default company.',
      inputSchema: { orderId: z.string(), shippingCompanyId: z.string().describe('From list_shipping_companies') },
      annotations: { idempotentHint: true }
    },
    safe(({ orderId, shippingCompanyId }) =>
      api.post(`/admin/fulfillment/orders/${orderId}/assign-company`, { shippingCompanyId })
    )
  )

  server.registerTool(
    'assign_manual_delivery',
    {
      title: 'Assign manual delivery',
      description: 'Assign an order to in-house delivery (no courier company).',
      inputSchema: { orderId: z.string() },
      annotations: { idempotentHint: true }
    },
    safe(({ orderId }) => api.post(`/admin/fulfillment/orders/${orderId}/assign-manual`))
  )

  server.registerTool(
    'dispatch_order',
    {
      title: 'Dispatch order to courier',
      description:
        'Creates the shipment at the assigned courier (calls their API) and hands the order over. The order must be Packed and have a company assigned. confirm=true also validates the parcel at the courier, which locks edits — leave it false unless the user explicitly asked.',
      inputSchema: {
        orderId: z.string(),
        confirm: z.boolean().default(false),
        askCollection: z.boolean().default(true).describe('Ask the courier to pick the parcel up from the shop')
      }
    },
    safe(({ orderId, ...body }) => api.post(`/admin/fulfillment/orders/${orderId}/dispatch`, body))
  )

  server.registerTool(
    'dispatch_order_manual',
    {
      title: 'Dispatch order manually',
      description: 'Record a shipment without calling any courier API; the tracking reference is typed in by hand.',
      inputSchema: { orderId: z.string(), trackingReference: z.string().min(1) }
    },
    safe(({ orderId, trackingReference }) =>
      api.post(`/admin/fulfillment/orders/${orderId}/dispatch-manual`, { trackingReference })
    )
  )

  server.registerTool(
    'bulk_dispatch_orders',
    {
      title: 'Dispatch many orders',
      description: 'Dispatch several Packed orders (each already assigned to a company) in one go. Returns per-order results.',
      inputSchema: {
        orderIds: z.array(z.string()).min(1).max(100),
        confirm: z.boolean().default(false),
        askCollection: z.boolean().default(true)
      }
    },
    safe((body) => api.post('/admin/fulfillment/orders/bulk-dispatch', body))
  )

  server.registerTool(
    'sync_fulfillment',
    {
      title: 'Sync courier statuses',
      description: 'Pull the latest shipment statuses from the couriers and advance orders accordingly.',
      inputSchema: {}
    },
    safe(() => api.post('/admin/fulfillment/sync'))
  )
}
