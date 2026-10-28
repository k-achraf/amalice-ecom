import { FUNNEL_NONE, ORDER_FILTER_KEYS, OrderFiltersSchema, cleanOrderFilters, type OrderFilters } from '@amalice/shared'
import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'

// Algiers is UTC+1 all year: a bare date means that whole local day.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseBound(raw: string | undefined, end: boolean): Date | undefined {
  if (!raw) return undefined
  const d = new Date(DATE_ONLY.test(raw) ? `${raw}T${end ? '23:59:59.999' : '00:00:00'}+01:00` : raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

// Reads the shared filter keys out of a raw query object and validates them (400 on invalid).
export function parseOrderFilters(query: Record<string, unknown>): OrderFilters {
  const picked: Record<string, unknown> = {}
  for (const k of ORDER_FILTER_KEYS) picked[k] = query[k]
  const parsed = OrderFiltersSchema.safeParse(cleanOrderFilters(picked))
  if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  return parsed.data
}

// The three filters that live on the shipment row. On GET admin/orders they are
// expressed through `order.shipment`; on GET admin/deliveries they apply to the
// shipment itself (see buildShipmentFilterWhere).
function shipmentConditions(f: OrderFilters): Prisma.ShipmentWhereInput[] {
  const out: Prisma.ShipmentWhereInput[] = []
  if (f.hasTracking === 'yes') out.push({ trackingReference: { not: null } })
  if (f.confirmedByCourier === 'yes') out.push({ carrierConfirmedAt: { not: null } })
  if (f.courierStatus) out.push({ courierStatus: f.courierStatus })
  return out
}

export function buildShipmentFilterWhere(f: OrderFilters): Prisma.ShipmentWhereInput {
  const and = shipmentConditions(f)
  if (f.hasTracking === 'no') and.push({ trackingReference: null })
  if (f.confirmedByCourier === 'no') and.push({ carrierConfirmedAt: null })
  return and.length ? { AND: and } : {}
}

// `forShipment`: the where is nested under Shipment.order, so the shipment-level
// keys are left out (the caller applies them with buildShipmentFilterWhere).
export function buildOrderFilterWhere(f: OrderFilters, opts: { forShipment?: boolean } = {}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = []
  if (f.productId) and.push({ items: { some: { productId: f.productId } } })
  if (f.variantId) and.push({ items: { some: { variantId: f.variantId } } })
  if (f.offerId) and.push({ items: { some: { offerId: f.offerId } } })
  if (f.funnelId) and.push(f.funnelId === FUNNEL_NONE ? { funnelId: null } : { funnelId: f.funnelId })
  if (f.companyId) and.push({ shippingCompanyId: f.companyId })
  if (f.region) and.push({ address: { region: { equals: f.region, mode: 'insensitive' } } })
  if (f.city) and.push({ address: { city: { equals: f.city, mode: 'insensitive' } } })
  if (f.shippingType) and.push({ shippingType: f.shippingType })
  if (f.platform) and.push({ attribution: { is: { platform: f.platform } } })
  if (f.riskLevel) and.push({ riskLevel: f.riskLevel })
  if (f.minTotal !== undefined) and.push({ totalCents: { gte: Math.round(f.minTotal * 100) } })
  if (f.maxTotal !== undefined) and.push({ totalCents: { lte: Math.round(f.maxTotal * 100) } })
  const from = parseBound(f.from, false)
  const to = parseBound(f.to, true)
  if (from) and.push({ createdAt: { gte: from } })
  if (to) and.push({ createdAt: { lte: to } })

  if (!opts.forShipment) {
    const sc = shipmentConditions(f)
    for (const c of sc) and.push({ shipment: { is: c } })
    // "No" also matches orders that have no shipment at all.
    if (f.hasTracking === 'no') and.push({ OR: [{ shipment: { is: null } }, { shipment: { is: { trackingReference: null } } }] })
    if (f.confirmedByCourier === 'no') and.push({ OR: [{ shipment: { is: null } }, { shipment: { is: { carrierConfirmedAt: null } } }] })
  }
  return and.length ? { AND: and } : {}
}
