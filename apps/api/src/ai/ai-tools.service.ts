import { Injectable } from '@nestjs/common'
import { CANCELLED_STATES, DELIVERED_STATES, RETURNED_STATES } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { AiTool } from './ai.service'

const MAX_DAYS = 90
const MAX_ROWS = 15

const clampDays = (value: unknown, fallback = 7): number => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_DAYS) : fallback
}
const clampLimit = (value: unknown, fallback = 10): number => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_ROWS) : fallback
}
const since = (days: number): Date => new Date(Date.now() - days * 86_400_000)
const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0)

const DAYS_PARAM = { type: 'INTEGER', description: `How many days back to look (1-${MAX_DAYS}). Default 7.` }

// The read-only data the business assistant may look at. Every tool returns
// small aggregates (never customer names/phones/addresses) and clamps its
// inputs: the model chooses the arguments, so they are never trusted. Order
// counts are by each order's CURRENT state, over orders created in the window.
@Injectable()
export class AiToolsService {
  constructor(private readonly prisma: PrismaService) {}

  tools(): AiTool[] {
    return [
      {
        name: 'sales_overview',
        description: 'Orders created in the last N days: total, confirmed pipeline, delivered (with revenue), returned, cancelled, still in progress, and delivery / return rates.',
        parameters: { type: 'OBJECT', properties: { days: DAYS_PARAM } },
        handler: (args) => this.salesOverview(clampDays(args.days))
      },
      {
        name: 'top_products',
        description: 'Best-selling products over the last N days by units ordered, with how many of their orders were delivered or returned.',
        parameters: { type: 'OBJECT', properties: { days: DAYS_PARAM, limit: { type: 'INTEGER', description: `Number of products (1-${MAX_ROWS}). Default 10.` } } },
        handler: (args) => this.topProducts(clampDays(args.days), clampLimit(args.limit))
      },
      {
        name: 'wilaya_performance',
        description: 'Per wilaya over the last N days: orders, delivered, returned, cancelled and return rate. Use it to find areas with many returns or strong delivery.',
        parameters: {
          type: 'OBJECT',
          properties: { days: DAYS_PARAM, minOrders: { type: 'INTEGER', description: 'Ignore wilayas with fewer orders than this. Default 5.' }, limit: { type: 'INTEGER', description: `Rows (1-${MAX_ROWS}). Default 10.` } }
        },
        handler: (args) => this.wilayaPerformance(clampDays(args.days, 30), Math.max(1, Math.round(Number(args.minOrders)) || 5), clampLimit(args.limit))
      },
      {
        name: 'call_center_performance',
        description: 'Per call-center agent over the last N days: calls made, orders confirmed and confirmation rate.',
        parameters: { type: 'OBJECT', properties: { days: DAYS_PARAM } },
        handler: (args) => this.callCenter(clampDays(args.days))
      },
      {
        name: 'low_stock',
        description: 'Products whose stock is at or below their low-stock threshold, lowest first.',
        parameters: { type: 'OBJECT', properties: { limit: { type: 'INTEGER', description: `Rows (1-${MAX_ROWS}). Default 10.` } } },
        handler: (args) => this.lowStock(clampLimit(args.limit))
      }
    ]
  }

  private async salesOverview(days: number) {
    const orders = await this.prisma.order.findMany({ where: { createdAt: { gte: since(days) }, isAbandoned: false }, select: { state: true, totalCents: true } })
    const delivered = orders.filter((o) => DELIVERED_STATES.includes(o.state))
    const returned = orders.filter((o) => RETURNED_STATES.includes(o.state))
    const cancelled = orders.filter((o) => CANCELLED_STATES.includes(o.state))
    const settled = delivered.length + returned.length
    return {
      days,
      totalOrders: orders.length,
      delivered: delivered.length,
      deliveredRevenueDzd: Math.round(delivered.reduce((s, o) => s + o.totalCents, 0) / 100),
      returned: returned.length,
      cancelled: cancelled.length,
      inProgress: orders.length - delivered.length - returned.length - cancelled.length,
      cancellationRatePct: pct(cancelled.length, orders.length),
      // Of orders that reached a final delivery outcome, the share delivered.
      deliveryRatePct: pct(delivered.length, settled)
    }
  }

  private async topProducts(days: number, limit: number) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since(days) }, isAbandoned: false } },
      select: { quantity: true, product: { select: { name: true } }, order: { select: { id: true, state: true } } }
    })
    const byProduct = new Map<string, { units: number; orders: Set<string>; delivered: Set<string>; returned: Set<string> }>()
    for (const item of items) {
      const row = byProduct.get(item.product.name) ?? { units: 0, orders: new Set(), delivered: new Set(), returned: new Set() }
      row.units += item.quantity
      row.orders.add(item.order.id)
      if (DELIVERED_STATES.includes(item.order.state)) row.delivered.add(item.order.id)
      if (RETURNED_STATES.includes(item.order.state)) row.returned.add(item.order.id)
      byProduct.set(item.product.name, row)
    }
    return {
      days,
      products: [...byProduct]
        .sort((a, b) => b[1].units - a[1].units)
        .slice(0, limit)
        .map(([name, r]) => ({ name, units: r.units, orders: r.orders.size, delivered: r.delivered.size, returned: r.returned.size, returnRatePct: pct(r.returned.size, r.delivered.size + r.returned.size) }))
    }
  }

  private async wilayaPerformance(days: number, minOrders: number, limit: number) {
    const orders = await this.prisma.order.findMany({ where: { createdAt: { gte: since(days) }, isAbandoned: false }, select: { state: true, address: { select: { region: true } } } })
    const byWilaya = new Map<string, { orders: number; delivered: number; returned: number; cancelled: number }>()
    for (const o of orders) {
      const row = byWilaya.get(o.address.region) ?? { orders: 0, delivered: 0, returned: 0, cancelled: 0 }
      row.orders++
      if (DELIVERED_STATES.includes(o.state)) row.delivered++
      else if (RETURNED_STATES.includes(o.state)) row.returned++
      else if (CANCELLED_STATES.includes(o.state)) row.cancelled++
      byWilaya.set(o.address.region, row)
    }
    return {
      days,
      minOrders,
      // Sorted by return rate: the question is almost always "where do returns hurt".
      wilayas: [...byWilaya]
        .filter(([, r]) => r.orders >= minOrders)
        .map(([wilaya, r]) => ({ wilaya, ...r, returnRatePct: pct(r.returned, r.delivered + r.returned) }))
        .sort((a, b) => b.returnRatePct - a.returnRatePct || b.orders - a.orders)
        .slice(0, limit)
    }
  }

  private async callCenter(days: number) {
    const calls = await this.prisma.callAttempt.findMany({ where: { createdAt: { gte: since(days) } }, select: { agentEmail: true, toState: true } })
    const byAgent = new Map<string, { calls: number; confirmed: number }>()
    for (const c of calls) {
      // Local part only — enough to tell agents apart, no full email.
      const agent = (c.agentEmail ?? 'unknown').split('@')[0]!
      const row = byAgent.get(agent) ?? { calls: 0, confirmed: 0 }
      row.calls++
      if (c.toState === 'Confirmed') row.confirmed++
      byAgent.set(agent, row)
    }
    return {
      days,
      agents: [...byAgent].map(([agent, r]) => ({ agent, ...r, confirmationRatePct: pct(r.confirmed, r.calls) })).sort((a, b) => b.confirmed - a.confirmed)
    }
  }

  private async lowStock(limit: number) {
    const products = await this.prisma.product.findMany({ select: { name: true, stockQuantity: true, lowStockThreshold: true } })
    const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold).sort((a, b) => a.stockQuantity - b.stockQuantity)
    return { count: low.length, products: low.slice(0, limit).map((p) => ({ name: p.name, stock: p.stockQuantity, threshold: p.lowStockThreshold })) }
  }
}
