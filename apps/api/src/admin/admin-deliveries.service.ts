import { Injectable, Logger } from '@nestjs/common'
import {
  DELIVERY_STAGES,
  courierStatusLabel,
  deliveryStageOfCourierStatus,
  deliveryStageOfOrderState,
  normalizeCourierStatus,
  type DeliveryHistoryEntry,
  type DeliveryListItem,
  type DeliveryListResponse,
  type DeliveryRemark,
  type DeliveryStage,
  type OrderFilters
} from '@amalice/shared'
import type { Prisma } from '../generated/prisma/client'
import { buildOrderFilterWhere, buildShipmentFilterWhere } from './order-filter-where'
import { PrismaService } from '../prisma/prisma.service'
import { FulfillmentService } from '../fulfillment/fulfillment.service'
import { DhdApiService, type DhdTrackingActivity, type DhdTrackingInfo } from '../shipping-companies/dhd-api.service'

type Company = { id: string; name: string; baseUrl: string; apiToken: string | null }

// A request must always answer: everything the couriers are asked is capped by this
// deadline (their API allows 50 calls a minute and can be slow), and whatever did not
// arrive in time is reported on the card instead of keeping the page waiting.
const LIVE_DEADLINE_MS = 18_000

// "Delivery details": every order sent to a shipping company. The courier's side of the
// CURRENT PAGE's parcels is read live with ONE request per shipping company:
//   get/trackings/info — up to 100 parcels at once: status, driver, stop desk and each
//   parcel's delivery history (attempts, reasons, stations, drivers).
// Nothing else is asked of the courier here (no per-parcel calls, no polling, no
// automatic re-reads): the remarks (get/maj), fees and the courier actions belong to the
// order's own page. The stage tabs and their counts group parcels by the last status
// stored; the cards are live. If a courier can't be reached in time its cards say so
// and show what was last stored.
@Injectable()
export class AdminDeliveriesService {
  private readonly logger = new Logger(AdminDeliveriesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly dhd: DhdApiService,
    private readonly fulfillment: FulfillmentService
  ) {}

  private entryOf(a: DhdTrackingActivity): DeliveryHistoryEntry {
    return {
      at: a.date ? `${a.date}${a.time ? `T${a.time}` : ''}` : null,
      reason: a.reason ?? a.activity ?? null,
      details: a.details || null,
      station: a.station || null,
      driver: a.driver || null,
      postponedTo: a.postponed_to || null
    }
  }

  async list(args: { stage: DeliveryStage; companyId?: string; search?: string; filters?: OrderFilters; page: number; pageSize: number; refresh?: boolean }): Promise<DeliveryListResponse> {
    // "Refresh from couriers": first bring OUR stored statuses (and order states) in line
    // with every linked company, so the tab counts below match what the couriers report.
    const syncErrors: { company: string; message: string }[] = []
    if (args.refresh) {
      for (const r of await this.fulfillment.syncAllCompanies()) if (r.error) syncErrors.push({ company: r.company, message: r.error })
    }
    const search = args.search?.trim()
    // Filters narrow the one `where` below, so the stage tab counts, the total and
    // the page all respect them. companyId (alias `company`) is part of the filters.
    const filters: OrderFilters = { ...args.filters, ...(args.companyId && { companyId: args.companyId }) }
    const where: Prisma.ShipmentWhereInput = {
      AND: [
        { order: { AND: [{ archived: false }, buildOrderFilterWhere(filters, { forShipment: true })] } },
        buildShipmentFilterWhere(filters)
      ],
      ...(search && {
        OR: [
          { trackingReference: { contains: search, mode: 'insensitive' } },
          { orderId: { equals: search, mode: 'insensitive' } },
          { order: { customer: { phone: { contains: search, mode: 'insensitive' } } } },
          { order: { customer: { name: { contains: search, mode: 'insensitive' } } } },
          { driverName: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    // 1. Tabs and counts: one light query, grouped by the last stored status.
    const all = await this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: { id: true, courierStatus: true, trackingReference: true, carrierConfirmedAt: true, order: { select: { state: true, fulfillmentMethod: true } } }
    })
    const stageOf = (s: (typeof all)[number]): Exclude<DeliveryStage, 'all'> => {
      const code = s.courierStatus && s.courierStatus !== 'manual_dispatch' ? s.courierStatus : null
      const fromCode = code ? deliveryStageOfCourierStatus(code) : null
      if (fromCode) return fromCode
      if (!code && s.order.fulfillmentMethod === 'ShippingCompany' && s.trackingReference && !s.carrierConfirmedAt && s.order.state === 'HandedToCourier') return 'awaiting'
      return deliveryStageOfOrderState(s.order.state)
    }
    const counts = Object.fromEntries(DELIVERY_STAGES.map((st) => [st, 0])) as Record<DeliveryStage, number>
    const staged = all.map((s) => ({ id: s.id, stage: stageOf(s) }))
    for (const { stage } of staged) {
      counts.all++
      counts[stage]++
    }
    const filtered = staged.filter((x) => args.stage === 'all' || x.stage === args.stage)
    const pageIds = filtered.slice((args.page - 1) * args.pageSize, args.page * args.pageSize).map((x) => x.id)

    // 2. Our side of the page's parcels: order, customer, address, products.
    const rows = pageIds.length
      ? await this.prisma.shipment.findMany({
          where: { id: { in: pageIds } },
          include: {
            courier: { select: { name: true } },
            order: {
              include: {
                customer: { select: { name: true, phone: true } },
                address: { select: { region: true, city: true, line1: true } },
                shippingCompany: { select: { id: true, name: true } },
                items: { include: { product: { select: { name: true, imageUrl: true } }, variant: { include: { options: { include: { option: true } } } } } }
              }
            }
          }
        })
      : []
    const rowById = new Map(rows.map((r) => [r.id, r]))
    const ordered = pageIds.map((id) => rowById.get(id)!).filter(Boolean)

    // 3. The courier's live answer for exactly those parcels, under one deadline.
    const isApi = (s: (typeof ordered)[number]) => s.order.fulfillmentMethod === 'ShippingCompany' && !!s.trackingReference && s.courierStatus !== 'manual_dispatch' && !!s.order.shippingCompanyId
    const companyIds = [...new Set(ordered.filter(isApi).map((s) => s.order.shippingCompanyId!))]
    const companies = new Map<string, Company>()
    if (companyIds.length) {
      for (const c of await this.prisma.shippingCompany.findMany({ where: { id: { in: companyIds }, isLinked: true, apiToken: { not: null } } })) companies.set(c.id, c)
    }

    const details = new Map<string, DhdTrackingInfo>()
    const cardErrors = new Map<string, string>()
    const liveErrors: { company: string; message: string }[] = [...syncErrors]
    const deadline = Date.now() + LIVE_DEADLINE_MS
    const timeLeft = () => Math.max(deadline - Date.now(), 0)
    // Resolves with the call's result, or rejects when the deadline passes first.
    const within = <T>(promise: Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The courier took too long to answer.')), timeLeft())
        promise.then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
      })

    const byCompany = new Map<string, typeof ordered>()
    for (const r of ordered) {
      const cid = r.order.shippingCompanyId
      if (isApi(r) && cid && companies.has(cid)) byCompany.set(cid, [...(byCompany.get(cid) ?? []), r])
    }
    await Promise.all([...byCompany.entries()].map(async ([cid, list]) => {
      const c = companies.get(cid)!
      const trackings = list.map((r) => r.trackingReference!)
      const failAll = (message: string) => {
        for (const t of trackings) if (!details.has(t)) cardErrors.set(t, message)
        if (!liveErrors.some((e) => e.company === c.name)) liveErrors.push({ company: c.name, message })
      }
      try {
        // One request for every parcel of this company on the page.
        const info = await within(this.dhd.getTrackingsInfo(c.baseUrl, c.apiToken!, trackings))
        for (const [t, i] of Object.entries(info)) details.set(t, i)
      } catch (error) {
        failAll((error as Error).message)
      }
    }))

    // 4. Assemble: the courier's live answer wins; stored values only fill gaps for
    // parcels the courier could not be asked about, and those cards say so.
    const items: DeliveryListItem[] = ordered.map((s) => {
      const t = s.trackingReference
      const api = isApi(s)
      const info = t ? details.get(t) : undefined
      const live = api && !!info
      const code = info?.status ?? (api && s.courierStatus && s.courierStatus !== 'created' ? s.courierStatus : null)
      const history = (info?.activity ?? []).map((a) => this.entryOf(a)).reverse()
      const lastReason = history.find((h) => h.reason)?.reason ?? null
      const lastPostponed = history.find((h) => h.postponedTo)?.postponedTo ?? null
      const toIso = (v: string | null) => {
        const d = v ? new Date(`${v.replace(' ', 'T')}+01:00`) : null
        return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null
      }
      const remarks: DeliveryRemark[] = history.slice(0, 5).flatMap((h) => {
        const at = toIso(h.at)
        return at ? [{ at, kind: 'attempt' as const, text: [h.reason, h.details, h.postponedTo ? `Postponed to ${h.postponedTo}` : null].filter(Boolean).join(' — '), by: h.driver, station: h.station }] : []
      })
      const error = !api ? null : live ? null : ((t && cardErrors.get(t)) ?? (companies.has(s.order.shippingCompanyId ?? '') ? 'The courier did not return this parcel.' : 'This shipping company is not linked.'))
      const desk = info && (info.desk_phone || info.desk_commune || info.desk_address || info.desk_map_link) ? { phone: info.desk_phone, commune: info.desk_commune, address: info.desk_address, mapLink: info.desk_map_link } : live ? null : ((s.deskInfo as DeliveryListItem['desk']) ?? null)

      return {
        shipmentId: s.id,
        orderId: s.orderId,
        orderState: s.order.state,
        orderCreatedAt: s.order.createdAt.toISOString(),
        dispatchedAt: s.createdAt.toISOString(),
        codCents: s.order.totalCents,
        shippingType: s.order.shippingType,
        customer: s.order.customer,
        address: s.order.address,
        items: s.order.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          variantLabel: i.variant?.options.length ? i.variant.options.map((vo) => vo.option.displayValue ?? vo.option.value).join(' / ') : null,
          imageUrl: i.product.imageUrl
        })),
        courier: { name: s.order.shippingCompany?.name ?? s.courier.name, companyId: s.order.shippingCompany?.id ?? null },
        via: api ? 'api' : 'manual',
        trackingReference: t,
        courierStatusCode: code,
        courierStatusLabel: code ? courierStatusLabel(code) : null,
        // Anything past "ready to ship" means the courier has taken the parcel.
        confirmed: code ? !['prete_a_expedier', 'pret_a_expedier'].includes(normalizeCourierStatus(code)) : !!s.carrierConfirmedAt,
        confirmedAt: s.carrierConfirmedAt?.toISOString() ?? null,
        driverName: info?.driver_name ?? (live ? null : s.driverName),
        driverPhone: info?.driver_phone ?? (live ? null : s.driverPhone),
        desk,
        lastFailureReason: live ? lastReason : s.lastFailureReason,
        postponedTo: live ? lastPostponed : (s.postponedTo?.toISOString() ?? null),
        carrierFeeCents: s.carrierFeeCents,
        returnFeeCents: s.returnFeeCents,
        lastSyncedAt: live ? new Date().toISOString() : (s.lastSyncedAt?.toISOString() ?? null),
        remarks,
        history,
        source: { live, error }
      }
    })

    return { items, total: filtered.length, page: args.page, pageSize: args.pageSize, counts, fetchedAt: new Date().toISOString(), liveErrors }
  }
}
