import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Which abilities a curated tool needs. A tool is only registered for a token that holds ALL of
// them, so an agent never even sees tools it could not use. This is a convenience filter: the
// API itself enforces every token ability on every request, so a wrong entry here can hide a
// tool but can never grant access.
//
// Every tool must be listed: gate() throws at startup for an unmapped one, so a new tool cannot
// be shipped without deciding who may use it.
export const TOOL_ABILITIES: Record<string, readonly string[]> = {
  // generic: available to any token that has at least one ability; the API enforces each call
  find_api_endpoints: [],
  call_api: [],

  // orders
  list_orders: ['orders:read'],
  get_order: ['orders:read'],
  get_order_timeline: ['orders:read'],
  get_order_calls: ['orders:read'],
  transition_order: ['orders:write'],
  bulk_transition_orders: ['orders:write'],
  set_order_notes: ['orders:write'],
  list_deliveries: ['orders:read'],

  // products, media, variants, offers, upsells
  list_products: ['products:read'],
  get_product: ['products:read'],
  get_stock_history: ['products:read'],
  list_attributes: ['products:read'],
  list_product_upsells: ['products:read'],
  list_low_stock: ['products:read', 'inventory:read'],
  create_product: ['products:write'],
  update_product: ['products:write'],
  archive_product: ['products:write'],
  adjust_stock: ['products:write'],
  add_product_images: ['products:write'],
  reorder_product_images: ['products:write'],
  apply_product_attribute: ['products:write'],
  create_product_variant: ['products:write'],
  update_product_variant: ['products:write'],
  create_product_offer: ['products:write'],
  add_product_upsell: ['products:write'],
  delete_product_image: ['products:delete'],
  delete_product_offer: ['products:delete'],
  delete_product_upsell: ['products:delete'],

  // shipping & fulfillment
  list_shipping_companies: ['shipping:read'],
  get_shipping_rates: ['shipping:read'],
  get_order_tracking: ['shipping:read'],
  check_order_address: ['shipping:read'],
  assign_shipping_company: ['shipping:write'],
  assign_manual_delivery: ['shipping:write'],
  dispatch_order: ['shipping:write'],
  dispatch_order_manual: ['shipping:write'],
  bulk_dispatch_orders: ['shipping:write'],
  sync_fulfillment: ['shipping:write'],

  // analytics, visitors, funnels
  get_dashboard_stats: ['analytics:read'],
  get_traffic_overview: ['analytics:read'],
  list_visitors: ['analytics:read'],
  get_visitor: ['analytics:read'],
  list_funnels: ['funnels:read'],
  get_funnel: ['funnels:read'],
  get_funnel_stats: ['funnels:read'],
  get_funnel_next_test: ['funnels:read'],
  list_funnel_sessions: ['funnels:read'],
  get_funnel_session: ['funnels:read'],
  update_funnel: ['funnels:write']
}

export function gate(server: McpServer, held: readonly string[]): McpServer {
  const has = new Set(held)
  return new Proxy(server, {
    get(target, prop) {
      if (prop === 'registerTool') {
        return (name: string, ...rest: unknown[]) => {
          const needs = TOOL_ABILITIES[name]
          if (!needs) throw new Error(`Tool "${name}" has no entry in TOOL_ABILITIES`)
          if (!needs.every((a) => has.has(a))) return undefined
          return (target.registerTool as (...a: unknown[]) => unknown).call(target, name, ...rest)
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}
