import { registerAnalyticsTools } from './analytics.js'
import { registerGenericTools } from './generic.js'
import { registerOrderTools } from './orders.js'
import { registerProductTools } from './products.js'
import { registerShippingTools } from './shipping.js'
import type { ToolContext } from './util.js'

export function registerAllTools(ctx: ToolContext) {
  registerOrderTools(ctx)
  registerProductTools(ctx)
  registerShippingTools(ctx)
  registerAnalyticsTools(ctx)
  registerGenericTools(ctx)
}
