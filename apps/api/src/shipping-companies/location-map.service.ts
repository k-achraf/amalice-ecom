import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CourierCommuneOption,
  LocationMapCommuneRow,
  LocationMapCopySuggestion,
  LocationMapSummary,
  LocationMapWilayaDetail,
  LocationMapWilayaSummary,
  SetLocationMap,
  ShippingCompanyProvider
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { normalizePlaceName, type CourierCommune } from './address-matching'
import { classifyCommune, resolveCourierWilaya, type MapRowLike } from './location-map.util'

const numericOrder = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b)
const toOption = (c: CourierCommune): CourierCommuneOption => ({ name: c.name, postalCode: c.postalCode, hasStopDesk: c.hasStopDesk })

// Per-company mapping of OUR wilayas/communes onto the courier's own. Stored only; an agent
// applies it by hand on each order ("Convert location"), nothing is converted automatically.
@Injectable()
export class LocationMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private async company(provider: ShippingCompanyProvider) {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company) throw new NotFoundException('Shipping company not set up yet.')
    return company
  }

  // Synced communes of a company grouped by courier wilaya id (a single query).
  private async communesByWilaya(companyId: string, wilayaId?: string): Promise<Map<string, CourierCommune[]>> {
    const rows = await this.prisma.shippingCompanyCommune.findMany({
      where: { shippingCompanyId: companyId, ...(wilayaId ? { wilayaId } : {}) },
      select: { wilayaId: true, name: true, postalCode: true, hasStopDesk: true },
      orderBy: { name: 'asc' }
    })
    const map = new Map<string, CourierCommune[]>()
    for (const r of rows) {
      const list = map.get(r.wilayaId) ?? []
      list.push({ name: r.name, postalCode: r.postalCode, hasStopDesk: r.hasStopDesk })
      map.set(r.wilayaId, list)
    }
    return map
  }

  async summary(provider: ShippingCompanyProvider): Promise<LocationMapSummary> {
    const company = await this.company(provider)
    const [wilayas, ourCommunes, maps, byWilaya] = await Promise.all([
      this.prisma.wilaya.findMany({ select: { id: true, name: true } }),
      this.prisma.commune.findMany({ select: { wilayaId: true, name: true } }),
      this.prisma.shippingCompanyLocationMap.findMany({ where: { shippingCompanyId: company.id } }),
      this.communesByWilaya(company.id)
    ])
    const communesOf = new Map<string, string[]>()
    for (const c of ourCommunes) communesOf.set(c.wilayaId, [...(communesOf.get(c.wilayaId) ?? []), c.name])
    const wilayaRows = new Map<string, MapRowLike>()
    const mappedCommunes = new Map<string, Set<string>>()
    for (const m of maps) {
      if (m.ourCommune === '') wilayaRows.set(m.ourWilayaId, m)
      else mappedCommunes.set(m.ourWilayaId, (mappedCommunes.get(m.ourWilayaId) ?? new Set()).add(m.ourCommune))
    }

    const out: LocationMapWilayaSummary[] = [...wilayas]
      .sort((a, b) => numericOrder(a.id, b.id))
      .map((w) => {
        const courier = resolveCourierWilaya(w.id, wilayaRows.get(w.id))
        const courierCommunes = byWilaya.get(courier.id) ?? []
        const names = communesOf.get(w.id) ?? []
        const saved = mappedCommunes.get(w.id)
        const counts = { matched: 0, review: 0, unmapped: 0, mapped: 0 }
        for (const name of names) {
          if (saved?.has(name)) counts.mapped++
          else counts[classifyCommune(name, courierCommunes).status as 'matched' | 'review' | 'unmapped']++
        }
        return { wilayaId: w.id, wilayaName: w.name, courierWilayaId: courier.id, courierWilayaSource: courier.source, communeCount: names.length, ...counts }
      })

    return {
      company: { id: company.id, name: company.name, locationsSyncedAt: company.locationsSyncedAt?.toISOString() ?? null },
      wilayas: out,
      courierWilayaIds: [...byWilaya.keys()].sort(numericOrder)
    }
  }

  async wilayaDetail(provider: ShippingCompanyProvider, wilayaId: string): Promise<LocationMapWilayaDetail> {
    const company = await this.company(provider)
    const wilaya = await this.prisma.wilaya.findUnique({ where: { id: wilayaId }, include: { communes: { select: { name: true }, orderBy: { name: 'asc' } } } })
    if (!wilaya) throw new NotFoundException('Unknown wilaya')
    const maps = await this.prisma.shippingCompanyLocationMap.findMany({ where: { shippingCompanyId: company.id, ourWilayaId: wilayaId } })
    const wilayaRow = maps.find((m) => m.ourCommune === '') ?? null
    const courier = resolveCourierWilaya(wilayaId, wilayaRow)
    const courierCommunes = (await this.communesByWilaya(company.id, courier.id)).get(courier.id) ?? []
    const byName = new Map(maps.filter((m) => m.ourCommune !== '').map((m) => [m.ourCommune, m]))

    const communes: LocationMapCommuneRow[] = wilaya.communes.map((c) => {
      const row = byName.get(c.name)
      if (row) {
        return {
          commune: c.name,
          status: 'mapped',
          mapped: { courierWilayaId: row.courierWilayaId, courierCommune: row.courierCommune, courierPostalCode: row.courierPostalCode },
          matchedCommune: null,
          suggestions: []
        }
      }
      const cls = classifyCommune(c.name, courierCommunes)
      return { commune: c.name, status: cls.status, mapped: null, matchedCommune: cls.matchedCommune, suggestions: cls.suggestions }
    })
    return {
      wilayaId: wilaya.id,
      wilayaName: wilaya.name,
      courierWilayaId: courier.id,
      courierWilayaSource: courier.source,
      communes,
      courierCommunes: courierCommunes.map(toOption)
    }
  }

  async courierCommunes(provider: ShippingCompanyProvider, wilayaId: string): Promise<CourierCommuneOption[]> {
    if (!wilayaId) throw new BadRequestException('wilayaId is required')
    const company = await this.company(provider)
    return ((await this.communesByWilaya(company.id, wilayaId)).get(wilayaId) ?? []).map(toOption)
  }

  async set(provider: ShippingCompanyProvider, input: SetLocationMap, actor: AuditActor) {
    const company = await this.company(provider)
    const ourCommune = input.ourCommune ?? ''
    if (!(await this.prisma.wilaya.findUnique({ where: { id: input.ourWilayaId }, select: { id: true } }))) throw new BadRequestException('Unknown wilaya')

    let courierCommune: string | null = null
    let courierPostalCode: string | null = null
    if (ourCommune === '') {
      const exists = await this.prisma.shippingCompanyCommune.findFirst({ where: { shippingCompanyId: company.id, wilayaId: input.courierWilayaId }, select: { id: true } })
      if (!exists) throw new BadRequestException(`${company.name} has no communes for wilaya ${input.courierWilayaId} in its synced list.`)
    } else {
      if (!input.courierCommune) throw new BadRequestException('courierCommune is required for a commune mapping.')
      const row = await this.prisma.shippingCompanyCommune.findUnique({
        where: { shippingCompanyId_wilayaId_name: { shippingCompanyId: company.id, wilayaId: input.courierWilayaId, name: input.courierCommune } }
      })
      if (!row) throw new BadRequestException(`"${input.courierCommune}" is not in the commune list of ${company.name} for wilaya ${input.courierWilayaId}.`)
      courierCommune = row.name
      courierPostalCode = input.courierPostalCode || row.postalCode
    }

    const saved = await this.prisma.shippingCompanyLocationMap.upsert({
      where: { shippingCompanyId_ourWilayaId_ourCommune: { shippingCompanyId: company.id, ourWilayaId: input.ourWilayaId, ourCommune } },
      create: { shippingCompanyId: company.id, ourWilayaId: input.ourWilayaId, ourCommune, courierWilayaId: input.courierWilayaId, courierCommune, courierPostalCode },
      update: { courierWilayaId: input.courierWilayaId, courierCommune, courierPostalCode }
    })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ShippingCompany',
      entityId: provider,
      metadata: { locationMap: 'set', ourWilayaId: input.ourWilayaId, ourCommune, courierWilayaId: input.courierWilayaId, courierCommune }
    })
    return { ourWilayaId: saved.ourWilayaId, ourCommune: saved.ourCommune, courierWilayaId: saved.courierWilayaId, courierCommune: saved.courierCommune, courierPostalCode: saved.courierPostalCode }
  }

  async remove(provider: ShippingCompanyProvider, ourWilayaId: string, ourCommune: string, actor: AuditActor) {
    if (!ourWilayaId) throw new BadRequestException('ourWilayaId is required')
    const company = await this.company(provider)
    const { count } = await this.prisma.shippingCompanyLocationMap.deleteMany({ where: { shippingCompanyId: company.id, ourWilayaId, ourCommune } })
    if (count) {
      await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { locationMap: 'deleted', ourWilayaId, ourCommune } })
    }
    return { deleted: count }
  }

  // Rows another company already mapped, as suggestions only (never saved here).
  async copyFrom(provider: ShippingCompanyProvider, otherProvider: ShippingCompanyProvider, wilayaId?: string): Promise<LocationMapCopySuggestion[]> {
    const [company, other] = await Promise.all([this.company(provider), this.company(otherProvider)])
    if (company.id === other.id) throw new BadRequestException('Pick a different company.')
    const rows = await this.prisma.shippingCompanyLocationMap.findMany({
      where: { shippingCompanyId: other.id, ...(wilayaId ? { ourWilayaId: wilayaId } : {}) },
      orderBy: [{ ourWilayaId: 'asc' }, { ourCommune: 'asc' }]
    })
    const mine = await this.communesByWilaya(company.id)
    const sets = new Map<string, Set<string>>()
    const has = (wid: string, name: string) => {
      let s = sets.get(wid)
      if (!s) sets.set(wid, (s = new Set((mine.get(wid) ?? []).map((c) => normalizePlaceName(c.name)))))
      return s.has(normalizePlaceName(name))
    }
    return rows.map((r) => ({
      ourWilayaId: r.ourWilayaId,
      ourCommune: r.ourCommune,
      courierWilayaId: r.courierWilayaId,
      courierCommune: r.courierCommune,
      courierPostalCode: r.courierPostalCode,
      existsAtThisCompany: r.courierCommune ? has(r.courierWilayaId, r.courierCommune) : (mine.get(r.courierWilayaId)?.length ?? 0) > 0
    }))
  }
}
