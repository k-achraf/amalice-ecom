import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { matchCommune, normalizePlaceName } from './address-matching'

const DELIVERED = ['Delivered', 'CashCollected', 'Reconciled', 'Settled'] as const
const RETURNED = ['ReturnedToOrigin', 'Restocked'] as const
const WINDOW_DAYS = 180
// Pseudo-orders of the courier's national record blended into its wilaya
// record, so two lucky deliveries don't outrank a courier with 200 solid ones.
const PRIOR_WEIGHT = 8
const LOW_SAMPLE = 5

export interface CourierSuggestion {
  shippingCompanyId: string
  name: string
  // Shrunk (smoothed) delivery rate in [0,1] and the raw counts behind it.
  deliveryRate: number
  delivered: number
  returned: number
  lowSample: boolean
  // Tariff for this wilaya + delivery type; null = not configured for this company.
  deliveryPriceCents: number | null
  codFeeCents: number | null
  returnPriceCents: number | null
  // Delivery price + COD fee + (1 - rate) × return fee.
  expectedCostCents: number | null
  // rate × order total − expected cost: what shipping this order with that
  // courier is expected to leave, the figure used for ranking.
  expectedNetCents: number | null
  // Does the courier's synced commune list recognise the address?
  coverage: 'ok' | 'no' | 'unknown'
  recommended: boolean
}

// Ranks the linked shipping companies for one order from what actually
// happened to past orders in the same wilaya (delivered vs returned), weighed
// against each company's tariff for that wilaya. Read-only — the admin still
// picks the company.
@Injectable()
export class CourierRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async forOrder(orderId: string): Promise<{ wilaya: string | null; suggestions: CourierSuggestion[]; basis: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true, shippingType: true, address: { select: { region: true, city: true } } }
    })
    if (!order) throw new NotFoundException('Order not found')

    const region = order.address.region.trim()
    const wilayas = await this.prisma.wilaya.findMany({ select: { id: true, name: true } })
    const wanted = normalizePlaceName(region)
    const wilaya = wilayas.find((w) => normalizePlaceName(w.name) === wanted || w.id === region) ?? null

    const companies = await this.prisma.shippingCompany.findMany({ where: { isLinked: true }, select: { id: true, name: true } })
    if (!companies.length) return { wilaya: wilaya?.name ?? null, suggestions: [], basis: 'No linked shipping company.' }

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000)
    const closedStates = [...DELIVERED, ...RETURNED]
    const base = { shippingCompanyId: { in: companies.map((c) => c.id) }, state: { in: closedStates as never[] }, createdAt: { gte: since } }

    // National record per company + this wilaya's record per company.
    const [national, local] = await Promise.all([
      this.prisma.order.groupBy({ by: ['shippingCompanyId', 'state'], where: base, _count: { _all: true } }),
      this.prisma.order.groupBy({
        by: ['shippingCompanyId', 'state'],
        where: { ...base, address: { region: { equals: region, mode: 'insensitive' } } },
        _count: { _all: true }
      })
    ])
    const tally = (rows: typeof national) => {
      const m = new Map<string, { d: number; r: number }>()
      for (const row of rows) {
        const e = m.get(row.shippingCompanyId!) ?? { d: 0, r: 0 }
        if ((DELIVERED as readonly string[]).includes(row.state)) e.d += row._count._all
        else e.r += row._count._all
        m.set(row.shippingCompanyId!, e)
      }
      return m
    }
    const nat = tally(national)
    const loc = tally(local)
    const allD = [...nat.values()].reduce((n, v) => n + v.d, 0)
    const allR = [...nat.values()].reduce((n, v) => n + v.r, 0)
    const globalRate = allD + allR > 0 ? allD / (allD + allR) : 0.7

    const tariffs = wilaya
      ? await this.prisma.shippingCompanyTariff.findMany({ where: { wilayaId: wilaya.id, shippingCompanyId: { in: companies.map((c) => c.id) } } })
      : []
    const tariffBy = new Map(tariffs.map((t) => [t.shippingCompanyId, t]))
    const desk = order.shippingType === 'Desk'

    const communes = wilaya
      ? await this.prisma.shippingCompanyCommune.findMany({ where: { wilayaId: wilaya.id, shippingCompanyId: { in: companies.map((c) => c.id) } } })
      : []

    const out: CourierSuggestion[] = companies.map((c) => {
      const n = nat.get(c.id) ?? { d: 0, r: 0 }
      const l = loc.get(c.id) ?? { d: 0, r: 0 }
      const natRate = n.d + n.r > 0 ? n.d / (n.d + n.r) : globalRate
      const deliveryRate = (l.d + PRIOR_WEIGHT * natRate) / (l.d + l.r + PRIOR_WEIGHT)

      const t = tariffBy.get(c.id)
      const price = t ? (desk ? t.deliveryStopdeskPriceCents : t.deliveryPriceCents) ?? null : null
      const cod = t ? (desk ? t.codFeeStopdeskPriceCents : t.codFeePriceCents) ?? 0 : null
      const ret = t ? (desk ? t.returnStopdeskPriceCents : t.returnPriceCents) ?? 0 : null
      const expectedCost = price != null ? Math.round(price + (cod ?? 0) + (1 - deliveryRate) * (ret ?? 0)) : null

      const own = communes.filter((x) => x.shippingCompanyId === c.id)
      const coverage: CourierSuggestion['coverage'] = !own.length
        ? 'unknown'
        : matchCommune(own.map((x) => ({ name: x.name, postalCode: x.postalCode, hasStopDesk: x.hasStopDesk })), order.address.city).match
          ? 'ok'
          : 'no'

      return {
        shippingCompanyId: c.id,
        name: c.name,
        deliveryRate,
        delivered: l.d,
        returned: l.r,
        lowSample: l.d + l.r < LOW_SAMPLE,
        deliveryPriceCents: price,
        codFeeCents: cod,
        returnPriceCents: ret,
        expectedCostCents: expectedCost,
        expectedNetCents: expectedCost != null ? Math.round(deliveryRate * order.totalCents - expectedCost) : null,
        coverage,
        recommended: false
      }
    })

    // Couriers that don't recognise the address go last; unknown tariff next;
    // then best expected net, with delivery rate as the tiebreak.
    const tier = (s: CourierSuggestion) => (s.coverage === 'no' ? 2 : s.expectedNetCents == null ? 1 : 0)
    out.sort((a, b) => tier(a) - tier(b) || (b.expectedNetCents ?? -Infinity) - (a.expectedNetCents ?? -Infinity) || b.deliveryRate - a.deliveryRate)
    if (out[0] && tier(out[0]) < 2) out[0].recommended = true

    return {
      wilaya: wilaya?.name ?? null,
      suggestions: out,
      basis: `Closed orders (delivered / returned) of the last ${WINDOW_DAYS} days in ${wilaya?.name ?? region}, blended with each courier's national record, against its tariff for this wilaya.`
    }
  }
}
