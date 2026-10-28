import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DEFAULT_COURIER_PARENT_WILAYA, SHIPPING_COMPANY_CATALOG, SHIPPING_COMPANY_WEBHOOK_SLUG } from '@amalice/shared'
import type {
  ApplyShippingCompanyTariffs,
  ApplyShippingCompanyTariffsResult,
  CourierWebhookLogResponse,
  CourierWebhookRawLogResponse,
  LinkShippingCompany,
  SetWebhookSecret,
  ShippingCompanyProvider,
  ShippingCompanyTariff,
  ShippingCompanyView,
  SyncShippingCompanyTariffsResult
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { DhdApiService } from './dhd-api.service'
import type { Env } from '../config/env.validation'

// Display name + default base URL of every supported provider, and the webhook path each one lands on
// (see fulfillment/webhooks.controller.ts). Both live in packages/shared so the admin and API agree.
// DHD and the Ecotrack-hosted couriers share one API client: they differ only by base URL.
const PROVIDER_CATALOG = SHIPPING_COMPANY_CATALOG

@Injectable()
export class ShippingCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dhd: DhdApiService,
    private readonly config: ConfigService<Env, true>
  ) {}

  private toView(
    provider: ShippingCompanyProvider,
    row: { id: string; baseUrl: string; apiToken: string | null; webhookSecret: string | null; isLinked: boolean; isDefault: boolean; lastSyncedAt: Date | null; locationsSyncedAt: Date | null } | null,
    communesCount = 0
  ): ShippingCompanyView {
    const catalog = PROVIDER_CATALOG[provider]
    return {
      id: row?.id ?? null,
      provider,
      name: catalog.name,
      baseUrl: row?.baseUrl ?? catalog.baseUrl,
      hasApiToken: !!row?.apiToken,
      isLinked: row?.isLinked ?? false,
      isDefault: row?.isDefault ?? false,
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      locationsSyncedAt: row?.locationsSyncedAt?.toISOString() ?? null,
      communesCount,
      // Only buildable once the row (and its real id) exists — see
      // ShippingCompanyViewSchema's comment.
      webhookUrl: row?.id ? `${this.config.get('PUBLIC_API_URL', { infer: true })}/webhooks/${SHIPPING_COMPANY_WEBHOOK_SLUG[provider]}/${row.id}` : null,
      hasWebhookSecret: !!row?.webhookSecret
    }
  }

  async list(): Promise<ShippingCompanyView[]> {
    const rows = await this.prisma.shippingCompany.findMany()
    const byProvider = new Map(rows.map((r) => [r.provider, r]))
    const counts = await this.prisma.shippingCompanyCommune.groupBy({ by: ['shippingCompanyId'], _count: { _all: true } })
    const countById = new Map(counts.map((c) => [c.shippingCompanyId, c._count._all]))
    return (Object.keys(PROVIDER_CATALOG) as ShippingCompanyProvider[]).map((provider) => {
      const row = byProvider.get(provider) ?? null
      return this.toView(provider, row, row ? (countById.get(row.id) ?? 0) : 0)
    })
  }

  // Every supported provider speaks the same Ecotrack API, so one client serves them all.
  private client(_provider: ShippingCompanyProvider) {
    return this.dhd
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

    // Best-effort: pull the courier's commune list right away so address
    // checks work from the first order. A failure here must not undo the link.
    const synced = await this.syncLocations(provider, null).then(() => true, () => false)
    if (synced) {
      const fresh = await this.prisma.shippingCompany.findUnique({ where: { provider } })
      const count = await this.prisma.shippingCompanyCommune.count({ where: { shippingCompanyId: row.id } })
      return this.toView(provider, fresh ?? row, count)
    }
    return this.toView(provider, row)
  }

  // The HMAC secret the provider's own webhook config is configured to sign
  // with — pasted in from there, never generated here (see
  // SetWebhookSecretSchema's comment). Requires the company already be
  // linked, since there's no row/id to build a webhook URL from otherwise.
  async setWebhookSecret(provider: ShippingCompanyProvider, input: SetWebhookSecret, actor: AuditActor): Promise<ShippingCompanyView> {
    const existing = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!existing) throw new NotFoundException(`Link ${PROVIDER_CATALOG[provider].name} before configuring its webhook.`)

    // Trimmed defensively — a copy-pasted secret with a stray leading/
    // trailing space or newline would silently produce a wrong HMAC on
    // every webhook (the storefront/admin side has no way to notice; it
    // just fails as a generic "Invalid signature" on delivery).
    const row = await this.prisma.shippingCompany.update({
      where: { provider },
      data: { webhookSecret: input.secret.trim() }
    })

    await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { webhookSecretSet: true } })

    return this.toView(provider, row)
  }

  // Admin-facing view of DHD's own "Logs de livraison" page — every inbound
  // webhook delivery for this provider, newest first, optionally filtered
  // by tracking reference. stateTitle is pulled out of the stored raw
  // payload at read time rather than a separate column, since it's purely
  // display sugar over `event`.
  async listWebhookLogs(provider: ShippingCompanyProvider, args: { page: number; pageSize: number; trackingReference?: string }): Promise<CourierWebhookLogResponse> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company) return { items: [], total: 0, page: args.page, pageSize: args.pageSize }

    const where = {
      shippingCompanyId: company.id,
      ...(args.trackingReference && { trackingReference: { contains: args.trackingReference, mode: 'insensitive' as const } })
    }
    const [rows, total] = await Promise.all([
      this.prisma.courierWebhookEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.courierWebhookEvent.count({ where })
    ])

    const items = rows.map((row) => {
      const payload = row.payload as { data?: { state?: { title?: string } } } | null
      return {
        id: row.id,
        trackingReference: row.trackingReference,
        event: row.event,
        stateTitle: payload?.data?.state?.title ?? null,
        orderId: row.orderId,
        applied: row.applied,
        error: row.error,
        receivedAt: row.receivedAt.toISOString()
      }
    })

    return { items, total, page: args.page, pageSize: args.pageSize }
  }

  // The RAW delivery log (see CourierWebhookLog's Prisma comment) — every
  // inbound request unconditionally, including ones rejected before
  // signature verification even ran (unknown company id) or that failed it
  // (401) or failed payload parsing (400). This is what actually answers
  // "why does the webhook log look empty" during a run of failures, since
  // listWebhookLogs above can only ever show a request that succeeded all
  // the way through.
  async listWebhookRawLogs(provider: ShippingCompanyProvider, args: { page: number; pageSize: number }): Promise<CourierWebhookRawLogResponse> {
    // Filtered by provider name, not company id — unlike listWebhookLogs,
    // this doesn't early-return empty for an unlinked provider. A delivery
    // attempt landing at a now-orphaned/never-linked :shippingCompanyId is
    // exactly the kind of thing this log needs to surface, not hide.
    const where = { provider }
    const [rows, total] = await Promise.all([
      this.prisma.courierWebhookLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.courierWebhookLog.count({ where })
    ])

    const items = rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      statusCode: row.statusCode,
      signatureHeader: row.signatureHeader,
      signatureValid: row.signatureValid,
      errorMessage: row.errorMessage,
      headers: row.headers as Record<string, unknown>,
      rawBody: row.rawBody,
      receivedAt: row.receivedAt.toISOString()
    }))

    return { items, total, page: args.page, pageSize: args.pageSize }
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

    // Our newer wilayas (59-69, and 49/50/52/53/56 at couriers that don't list them) are communes of
    // another wilaya in the courier's system, so it quotes no tariff for them. They get the PARENT
    // wilaya's home price and no stop desk (price 0 = "not offered", which applies as desk delivery
    // disabled). The parent is the one saved on the Location mapping page, else the default.
    const savedParents = new Map(
      (await this.prisma.shippingCompanyLocationMap.findMany({ where: { shippingCompanyId: company.id, ourCommune: '' } })).map((m) => [m.ourWilayaId, m.courierWilayaId])
    )
    const derived = Object.keys(DEFAULT_COURIER_PARENT_WILAYA).flatMap((wilayaId) => {
      if (deliveryByWilaya.has(wilayaId) || !wilayaIds.has(wilayaId)) return []
      const parent = deliveryByWilaya.get(savedParents.get(wilayaId) ?? DEFAULT_COURIER_PARENT_WILAYA[wilayaId]!)
      if (!parent) return []
      const deliveryPriceCents = (Number.parseInt(parent.tarif, 10) || 0) * 100
      return [
        this.prisma.shippingCompanyTariff.upsert({
          where: { shippingCompanyId_wilayaId: { shippingCompanyId: company.id, wilayaId } },
          update: { deliveryPriceCents, deliveryStopdeskPriceCents: 0 },
          create: { shippingCompanyId: company.id, wilayaId, deliveryPriceCents, deliveryStopdeskPriceCents: 0 }
        })
      ]
    })
    if (derived.length) await this.prisma.$transaction(derived)
    syncedCount += derived.length

    const lastSyncedAt = new Date()
    await this.prisma.shippingCompany.update({ where: { provider }, data: { lastSyncedAt } })
    await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { syncedTariffs: syncedCount, derivedFromParentWilaya: derived.length } })

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

  // Pulls the courier's own wilaya/commune list (get/wilayas + get/communes):
  // the exact spellings it accepts and where a stop desk exists. Orders are
  // checked against this before dispatch, so a misspelled commune is caught
  // while the agent is still on the phone with the customer, not when the
  // courier rejects the parcel. Replaces the stored list atomically.
  async syncLocations(provider: ShippingCompanyProvider, actor: AuditActor | null): Promise<{ communesCount: number; wilayasCount: number; locationsSyncedAt: string }> {
    const company = await this.prisma.shippingCompany.findUnique({ where: { provider } })
    if (!company?.isLinked || !company.apiToken) throw new BadRequestException(`Link ${PROVIDER_CATALOG[provider].name} before syncing locations.`)

    const client = this.client(provider)
    const communes = await client.getCommunes(company.baseUrl, company.apiToken)
    if (!communes.length) throw new BadRequestException('The courier returned no communes.')
    const wilayas = await client.getWilayas(company.baseUrl, company.apiToken).catch(() => [])
    const active = new Set(wilayas.map((w) => String(w.wilaya_id)))

    const rows = communes
      .filter((c) => c.nom && c.wilaya_id != null && c.is_active !== 0 && (active.size === 0 || active.has(String(c.wilaya_id))))
      .map((c) => ({
        shippingCompanyId: company.id,
        wilayaId: String(c.wilaya_id),
        name: c.nom,
        postalCode: c.code_postal ? String(c.code_postal) : null,
        hasStopDesk: Number(c.has_stop_desk) === 1
      }))
    const locationsSyncedAt = new Date()
    await this.prisma.$transaction([
      this.prisma.shippingCompanyCommune.deleteMany({ where: { shippingCompanyId: company.id } }),
      this.prisma.shippingCompanyCommune.createMany({ data: rows, skipDuplicates: true }),
      this.prisma.shippingCompany.update({ where: { id: company.id }, data: { locationsSyncedAt } })
    ])
    if (actor) await this.audit.log({ actor, action: 'Update', entity: 'ShippingCompany', entityId: provider, metadata: { syncedLocations: rows.length } })
    return { communesCount: rows.length, wilayasCount: new Set(rows.map((r) => r.wilayaId)).size, locationsSyncedAt: locationsSyncedAt.toISOString() }
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
