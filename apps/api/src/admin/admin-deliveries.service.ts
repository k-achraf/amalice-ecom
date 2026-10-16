import { Injectable, Logger } from '@nestjs/common'
import {
  COURIER_CODES_BY_STAGE,
  DELIVERY_STAGES,
  courierStatusLabel,
  deliveryStageOfCourierStatus,
  deliveryStageOfOrderState,
  normalizeCourierStatus,
  type DeliveryHistoryEntry,
  type DeliveryListItem,
  type DeliveryListResponse,
  type DeliveryRemark,
  type DeliveryStage
} from '@amalice/shared'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { DhdApiService, type DhdListedOrder, type DhdParcelUpdate, type DhdTrackingActivity, type DhdTrackingInfo } from '../shipping-companies/dhd-api.service'

type Company = { id: string; name: string; baseUrl: string; apiToken: string | null }
interface Snapshot { at: number; byTracking: Map<string, DhdListedOrder> }

const SNAPSHOT_TTL_MS = 45_000
const MAX_LIST_PAGES = 25

// "Delivery details": every order sent to a shipping company, with the courier's
// side read LIVE from its API on every request (nothing stored is shown for a
// parcel the courier can be asked about):
//   - get/orders              the courier's list with every parcel's current status and
//                             fees → the stage tabs, their counts and the status filter
//   - get/trackings/info      status, driver, stop desk and the full delivery history
//                             (or get/orders/status, the same detail filtered by status,
//                             when a stage tab is open)
//   - get/maj                 the remarks added to each parcel
// The only local data is what the courier doesn't have: our order, customer, address
// and products. If a courier can't be reached, its cards say so and show what was last
// stored instead of silently looking current.
@Injectable()
export class AdminDeliveriesService {
  private readonly logger = new Logger(AdminDeliveriesService.name)
  // The courier answers 50 requests a minute: the list read (up to 25 pages) is
  // reused for a few seconds, so quickly flipping tabs doesn't re-read it each time.
  private readonly snapshots = new Map<string, Snapshot>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly dhd: DhdApiService
  ) {}

  private async snapshot(company: Company, force: boolean): Promise<Snapshot> {
    const cached = this.snapshots.get(company.id)
    if (!force && cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached
    const byTracking = new Map<string, DhdListedOrder>()
    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
      const res = await this.dhd.getOrders(company.baseUrl, company.apiToken!, { page })
      for (const o of res.data) byTracking.set(o.tracking, o)
      if (page >= res.lastPage) break
    }
    const snap = { at: Date.now(), byTracking }
    this.snapshots.set(company.id, snap)
    return snap
  }

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

  private toCents(value: string | null | undefined): number | null {
    if (value == null) return null
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? Math.round(n * 100) : null
  }

  // Runs `fn` over `items` with at most `limit` in flight (the client itself also
  // rate-limits per account).
  private async pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let i = 0
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]!)
    }))
  }

  async list(args: { stage: DeliveryStage; companyId?: string; search?: string; page: number; pageSize: number; refresh?: boolean }): Promise<DeliveryListResponse> {
    const search = args.search?.trim()
    const where: Prisma.ShipmentWhereInput = {
      order: { archived: false, ...(args.companyId && { shippingCompanyId: args.companyId }) },
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

    // 1. Every candidate parcel (light), so stage tabs and counts reflect the courier's live status.
    const all = await this.prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 3000,
      select: { id: true, trackingReference: true, courierStatus: true, carrierConfirmedAt: true, createdAt: true, order: { select: { state: true, fulfillmentMethod: true, shippingCompanyId: true } } }
    })
    const isApi = (s: (typeof all)[number]) => s.order.fulfillmentMethod === 'ShippingCompany' && !!s.trackingReference && s.courierStatus !== 'manual_dispatch' && !!s.order.shippingCompanyId

    // 2. The courier's list, once per company involved.
    const companyIds = [...new Set(all.filter(isApi).map((s) => s.order.shippingCompanyId!))]
    const companies = new Map<string, Company>()
    if (companyIds.length) {
      for (const c of await this.prisma.shippingCompany.findMany({ where: { id: { in: companyIds }, isLinked: true, apiToken: { not: null } } })) companies.set(c.id, c)
    }
    const snapshots = new Map<string, Snapshot>()
    const liveErrors: { company: string; message: string }[] = []
    const failedCompanies = new Set<string>()
    await Promise.all([...companies.values()].map(async (c) => {
      try {
        snapshots.set(c.id, await this.snapshot(c, !!args.refresh))
      } catch (error) {
        failedCompanies.add(c.id)
        liveErrors.push({ company: c.name, message: (error as Error).message })
        this.logger.warn(`Live list failed for ${c.name}: ${(error as Error).message}`)
      }
    }))

    const liveStatus = (s: (typeof all)[number]): string | null => {
      if (!isApi(s)) return null
      return snapshots.get(s.order.shippingCompanyId!)?.byTracking.get(s.trackingReference!)?.status ?? null
    }
    // A parcel the courier's list doesn't contain (archived there, or older than its
    // 90-day window) falls back to what we last stored for the grouping only.
    const stageOf = (s: (typeof all)[number]): Exclude<DeliveryStage, 'all'> => {
      const code = liveStatus(s)
      const fromCode = code ? deliveryStageOfCourierStatus(code) : null
      if (fromCode) return fromCode
      if (isApi(s) && !s.carrierConfirmedAt && s.order.state === 'HandedToCourier') return 'awaiting'
      return deliveryStageOfOrderState(s.order.state)
    }

    const counts = Object.fromEntries(DELIVERY_STAGES.map((st) => [st, 0])) as Record<DeliveryStage, number>
    const staged = all.map((s) => ({ s, stage: stageOf(s) }))
    for (const { stage } of staged) {
      counts.all++
      counts[stage]++
    }
    const filtered = staged.filter((x) => args.stage === 'all' || x.stage === args.stage)
    const pageIds = filtered.slice((args.page - 1) * args.pageSize, args.page * args.pageSize).map((x) => x.s.id)

    // 3. Our side of the page's parcels: order, customer, address, products.
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

    // 4. The courier's detail for exactly those parcels.
    const details = new Map<string, DhdTrackingInfo>()
    const updates = new Map<string, DhdParcelUpdate[]>()
    const detailErrors = new Map<string, string>()
    const byCompany = new Map<string, typeof ordered>()
    for (const r of ordered) {
      const cid = r.order.shippingCompanyId
      if (!cid || !companies.has(cid) || failedCompanies.has(cid) || r.order.fulfillmentMethod !== 'ShippingCompany' || !r.trackingReference || r.courierStatus === 'manual_dispatch') continue
      byCompany.set(cid, [...(byCompany.get(cid) ?? []), r])
    }
    await Promise.all([...byCompany.entries()].map(async ([cid, list]) => {
      const c = companies.get(cid)!
      const trackings = list.map((r) => r.trackingReference!)
      try {
        // With a stage tab open the status-filtered call is used; it returns the same detail.
        const info = args.stage === 'all'
          ? await this.dhd.getTrackingsInfo(c.baseUrl, c.apiToken!, trackings)
          : await this.dhd.getOrdersByStatus(c.baseUrl, c.apiToken!, trackings, COURIER_CODES_BY_STAGE[args.stage])
        for (const [t, i] of Object.entries(info)) details.set(t, i)
        // Remarks are one call per parcel.
        await this.pool(trackings, 4, async (t) => {
          try {
            updates.set(t, await this.dhd.getUpdates(c.baseUrl, c.apiToken!, t))
          } catch (error) {
            this.logger.warn(`get/maj failed for ${t}: ${(error as Error).message}`)
          }
        })
      } catch (error) {
        for (const t of trackings) detailErrors.set(t, (error as Error).message)
        liveErrors.push({ company: c.name, message: (error as Error).message })
      }
    }))

    // 5. Assemble: the courier's live answer wins; stored values only fill gaps for
    // parcels the courier could not be asked about, and those cards say so.
    const items: DeliveryListItem[] = ordered.map((s) => {
      const t = s.trackingReference
      const api = !!t && s.courierStatus !== 'manual_dispatch' && s.order.fulfillmentMethod === 'ShippingCompany'
      const info = t ? details.get(t) : undefined
      const listed = t && s.order.shippingCompanyId ? snapshots.get(s.order.shippingCompanyId)?.byTracking.get(t) : undefined
      const live = api && (!!info || !!listed)
      const code = info?.status ?? listed?.status ?? (api && s.courierStatus && s.courierStatus !== 'created' ? s.courierStatus : null)
      const history = (info?.activity ?? []).map((a) => this.entryOf(a)).reverse()
      const lastReason = history.find((h) => h.reason)?.reason ?? null
      const lastPostponed = history.find((h) => h.postponedTo)?.postponedTo ?? null
      const remarks: DeliveryRemark[] = [
        ...(updates.get(t ?? '') ?? []).map((u): DeliveryRemark => ({ at: u.created_at ? new Date(`${u.created_at.replace(' ', 'T')}+01:00`).toISOString() : new Date().toISOString(), kind: 'remark', text: u.remarque, by: u.livreur || null, station: u.station || null })),
        ...history.slice(0, 5).map((h): DeliveryRemark => ({ at: h.at ? new Date(`${h.at}+01:00`).toISOString() : new Date().toISOString(), kind: 'attempt', text: [h.reason, h.details, h.postponedTo ? `Postponed to ${h.postponedTo}` : null].filter(Boolean).join(' — '), by: h.driver, station: h.station }))
      ].filter((r) => !Number.isNaN(new Date(r.at).getTime())).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
      const error = !api ? null : failedCompanies.has(s.order.shippingCompanyId ?? '') ? 'The shipping company could not be reached.' : (t && detailErrors.get(t)) || null
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
        confirmed: code ? normalizeCourierStatus(code) !== 'prete_a_expedier' && normalizeCourierStatus(code) !== 'pret_a_expedier' : !!s.carrierConfirmedAt,
        confirmedAt: s.carrierConfirmedAt?.toISOString() ?? null,
        driverName: info?.driver_name ?? (live ? null : s.driverName),
        driverPhone: info?.driver_phone ?? (live ? null : s.driverPhone),
        desk,
        lastFailureReason: live ? lastReason : s.lastFailureReason,
        postponedTo: live ? lastPostponed : (s.postponedTo?.toISOString() ?? null),
        carrierFeeCents: live ? this.toCents(listed?.tarif_prestation) : s.carrierFeeCents,
        returnFeeCents: live ? this.toCents(listed?.tarif_retour) : s.returnFeeCents,
        lastSyncedAt: live ? new Date().toISOString() : (s.lastSyncedAt?.toISOString() ?? null),
        remarks,
        history,
        source: { live, error }
      }
    })

    return { items, total: filtered.length, page: args.page, pageSize: args.pageSize, counts, fetchedAt: new Date().toISOString(), liveErrors }
  }
}
