import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  ApplyShippingCompanyTariffs,
  ApplyShippingCompanyTariffsResult,
  LinkShippingCompany,
  ShippingCompanyProvider,
  ShippingCompanyTariff,
  ShippingCompanyView,
  SyncShippingCompanyTariffsResult
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { DhdApiService } from './dhd-api.service'

// The fixed catalog of supported providers — DHD today, more land here as
// entries (name + default base URL) plus a DHD-shaped client. Every
// provider in this catalog shows up as a card in the admin Shipping
// Companies section whether or not it's been linked yet.
const PROVIDER_CATALOG: Record<ShippingCompanyProvider, { name: string; baseUrl: string }> = {
  Dhd: { name: 'DHD', baseUrl: 'https://platform.dhd-dz.com' }
}

@Injectable()
export class ShippingCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dhd: DhdApiService
  ) {}

  private toView(provider: ShippingCompanyProvider, row: { id: string; baseUrl: string; apiToken: string | null; isLinked: boolean; isDefault: boolean; lastSyncedAt: Date | null } | null): ShippingCompanyView {
    const catalog = PROVIDER_CATALOG[provider]
    return {
      id: row?.id ?? null,
      provider,
      name: catalog.name,
      baseUrl: row?.baseUrl ?? catalog.baseUrl,
      hasApiToken: !!row?.apiToken,
      isLinked: row?.isLinked ?? false,
      isDefault: row?.isDefault ?? false,
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null
    }
  }

  async list(): Promise<ShippingCompanyView[]> {
    const rows = await this.prisma.shippingCompany.findMany()
    const byProvider = new Map(rows.map((r) => [r.provider, r]))
    return (Object.keys(PROVIDER_CATALOG) as ShippingCompanyProvider[]).map((provider) =>
      this.toView(provider, byProvider.get(provider) ?? null)
    )
  }

  private client(provider: ShippingCompanyProvider) {
    if (provider === 'Dhd') return this.dhd
    throw new BadRequestException(`Unsupported shipping company: ${provider}`)
  }

  // The single "which shipping company do we actually ship with" resolver —
  // FulfillmentService and DhdCourierProvider both call this instead of
  // hardcoding `provider: 'Dhd'`, so "always use the default shipping
  // company" holds even once a second provider lands in PROVIDER_CATALOG.
  // Falls back to "the one linked company" when exactly one is linked but
  // none has been explicitly marked default yet — linking a single provider
  // is the common case, and forcing an extra "set as default" click before
  // dispatch works at all would be a real footgun, not a safety feature.
  async getDefaultLinked(): Promise<{ provider: ShippingCompanyProvider; name: string; baseUrl: string; apiToken: string }> {
    const linked = await this.prisma.shippingCompany.findMany({ where: { isLinked: true } })
    const company = linked.find((c) => c.isDefault) ?? (linked.length === 1 ? linked[0] : undefined)
    if (!company?.apiToken) {
      throw new BadRequestException(
        linked.length > 1
          ? 'More than one shipping company is linked but none is set as default — set one under Settings → Shipping Companies.'
          : 'No shipping company is linked — link one under Settings → Shipping Companies first.'
      )
    }
    return { provider: company.provider, name: PROVIDER_CATALOG[company.provider].name, baseUrl: company.baseUrl, apiToken: company.apiToken }
  }

  async link(provider: ShippingCompanyProvider, input: LinkShippingCompany, actor: AuditActor): Promise<ShippingCompanyView> {
    const catalog = PROVIDER_CATALOG[provider]
    const existing = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    const baseUrl = existing?.baseUrl ?? catalog.baseUrl

    // Confirm the token actually works before persisting it — a bad token
    // must fail here, not silently at the next sync.
    await this.client(provider).validateToken(baseUrl, input.apiToken)

    const row = await this.prisma.shippingCompany.upsert({
      where: { provider },
      update: { apiToken: input.apiToken, isLinked: true },
      create: { provider, name: catalog.name, baseUrl, apiToken: input.apiToken, isLinked: true }
    })

    await this.audit.log({
      actor,
      action: existing ? 'Update' : 'Create',
      entity: 'ShippingCompany',
      entityId: provider,
      metadata: { linked: true }
    })

    return this.toView(provider, row)
  }

  async unlink(provider: ShippingCompanyProvider, actor: AuditActor): Promise<ShippingCompanyView> {
    const existing = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!existing) throw new NotFoundException(`${provider} isn't linked.`)

    const row = await this.prisma.shippingCompany.update({
      where: { provider },
      data: { apiToken: null, isLinked: false, isDefault: false }
    })

    await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { linked: false } })

    return this.toView(provider, row)
  }

  // Exactly one linked company can be default — unset every other row in
  // the same transaction rather than relying on a DB constraint (Postgres
  // can't express "at most one true" without a partial unique index this
  // schema doesn't otherwise use).
  async setDefault(provider: ShippingCompanyProvider, actor: AuditActor): Promise<ShippingCompanyView[]> {
    const target = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!target?.isLinked) throw new BadRequestException(`Link ${PROVIDER_CATALOG[provider].name} before setting it as default.`)

    await this.prisma.$transaction([
      this.prisma.shippingCompany.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.shippingCompany.update({ where: { provider }, data: { isDefault: true } })
    ])

    await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { isDefault: true } })

    return this.list()
  }

  // GET the provider's tariffs and upsert them into ShippingCompanyTariff —
  // reference data only, never touches the live WilayaShippingRate (see
  // that model's Prisma comment). Rows for a wilaya_id our Wilaya table
  // doesn't have (DHD returns numeric ids; ours use the same numeric string
  // as the natural key — see Wilaya's Prisma comment) are silently skipped
  // rather than failing the whole sync.
  async syncTariffs(provider: ShippingCompanyProvider, actor: AuditActor): Promise<SyncShippingCompanyTariffsResult> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company?.isLinked || !company.apiToken) throw new BadRequestException(`Link ${PROVIDER_CATALOG[provider].name} before syncing tariffs.`)

    const fees = await this.client(provider).getFees(company.baseUrl, company.apiToken)

    const wilayaIds = new Set((await this.prisma.wilaya.findMany({ select: { id: true } })).map((w) => w.id))
    const deliveryByWilaya = new Map(fees.livraison.map((f) => [String(f.wilaya_id), f]))

    let syncedCount = 0
    await this.prisma.$transaction(
      [...deliveryByWilaya.entries()]
        .filter(([wilayaId]) => wilayaIds.has(wilayaId))
        .map(([wilayaId, fee]) => {
          syncedCount++
          // DHD quotes tarifs in whole DZD (e.g. "1300" = 1300 DZD), not
          // cents/centimes — multiply by 100 to match this app's cents-based
          // money convention (every *PriceCents field, incl. WilayaShippingRate,
          // stores amount * 100 regardless of currency). Storing DHD's raw
          // value here would silently under-price everything 100x once
          // applied to the live Shipping Rates.
          const deliveryPriceCents = (Number.parseInt(fee.tarif, 10) || 0) * 100
          const deliveryStopdeskPriceCents = (Number.parseInt(fee.tarif_stopdesk, 10) || 0) * 100
          return this.prisma.shippingCompanyTariff.upsert({
            where: { shippingCompanyId_wilayaId: { shippingCompanyId: company.id, wilayaId } },
            update: { deliveryPriceCents, deliveryStopdeskPriceCents },
            create: { shippingCompanyId: company.id, wilayaId, deliveryPriceCents, deliveryStopdeskPriceCents }
          })
        })
    )

    const lastSyncedAt = new Date()
    await this.prisma.shippingCompany.update({ where: { provider }, data: { lastSyncedAt } })
    await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { syncedTariffs: syncedCount } })

    return { syncedCount, lastSyncedAt: lastSyncedAt.toISOString() }
  }

  async listTariffs(provider: ShippingCompanyProvider): Promise<ShippingCompanyTariff[]> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company) return []
    const rows = await this.prisma.shippingCompanyTariff.findMany({
      where: { shippingCompanyId: company.id },
      include: { wilaya: true },
      orderBy: { wilaya: { name: 'asc' } }
    })
    return rows.map((r) => ({
      wilayaId: r.wilayaId,
      wilayaName: r.wilaya.name,
      deliveryPriceCents: r.deliveryPriceCents,
      deliveryStopdeskPriceCents: r.deliveryStopdeskPriceCents
    }))
  }

  // Explicit, admin-triggered copy of synced tariffs into the live
  // WilayaShippingRate — a stopdesk price of 0 (DHD's "not offered here"
  // convention, see ShippingCompanyTariff's Prisma comment) applies as desk
  // delivery disabled rather than a free desk price.
  async applyTariffsToRates(provider: ShippingCompanyProvider, input: ApplyShippingCompanyTariffs, actor: AuditActor): Promise<ApplyShippingCompanyTariffsResult> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company) throw new NotFoundException(`${provider} isn't linked.`)

    const tariffs = await this.prisma.shippingCompanyTariff.findMany({
      where: {
        shippingCompanyId: company.id,
        ...(input.wilayaIds ? { wilayaId: { in: input.wilayaIds } } : {})
      }
    })

    let appliedCount = 0
    await this.prisma.$transaction(
      tariffs
        .filter((t) => t.deliveryPriceCents != null)
        .map((t) => {
          appliedCount++
          const homeDeliveryPriceCents = t.deliveryPriceCents as number
          const deskEnabled = (t.deliveryStopdeskPriceCents ?? 0) > 0
          return this.prisma.wilayaShippingRate.upsert({
            where: { wilayaId: t.wilayaId },
            update: {
              homeDeliveryEnabled: true,
              homeDeliveryPriceCents,
              deskDeliveryEnabled: deskEnabled,
              deskDeliveryPriceCents: deskEnabled ? t.deliveryStopdeskPriceCents : null
            },
            create: {
              wilayaId: t.wilayaId,
              homeDeliveryEnabled: true,
              homeDeliveryPriceCents,
              deskDeliveryEnabled: deskEnabled,
              deskDeliveryPriceCents: deskEnabled ? t.deliveryStopdeskPriceCents : null
            }
          })
        })
    )

    await this.audit.log({ actor, action: 'Update', entity: 'WilayaShippingRate', entityId: 'bulk', metadata: { appliedFrom: provider, appliedCount } })

    return { appliedCount }
  }
}
