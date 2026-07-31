import { Injectable } from '@nestjs/common'
import type { UpdateWilayaShippingRates, WilayaShippingRate } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Per-wilaya delivery pricing (home + desk, independently enabled) — see
// WilayaShippingRate's Prisma comment. The whole table (58 wilayas) is
// edited and saved together from the admin's Shipping settings page, not
// row-by-row, so this is a bulk upsert rather than per-row CRUD.
@Injectable()
export class AdminShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listRates(): Promise<WilayaShippingRate[]> {
    const wilayas = await this.prisma.wilaya.findMany({
      orderBy: { name: 'asc' },
      include: { shippingRate: true }
    })
    return wilayas.map((w) => ({
      wilayaId: w.id,
      wilayaName: w.name,
      homeDeliveryEnabled: w.shippingRate?.homeDeliveryEnabled ?? false,
      homeDeliveryPriceCents: w.shippingRate?.homeDeliveryPriceCents ?? null,
      deskDeliveryEnabled: w.shippingRate?.deskDeliveryEnabled ?? false,
      deskDeliveryPriceCents: w.shippingRate?.deskDeliveryPriceCents ?? null
    }))
  }

  async updateRates(input: UpdateWilayaShippingRates, actor: AuditActor): Promise<WilayaShippingRate[]> {
    await this.prisma.$transaction(
      input.rates.map((rate) =>
        this.prisma.wilayaShippingRate.upsert({
          where: { wilayaId: rate.wilayaId },
          update: {
            homeDeliveryEnabled: rate.homeDeliveryEnabled,
            homeDeliveryPriceCents: rate.homeDeliveryEnabled ? rate.homeDeliveryPriceCents : null,
            deskDeliveryEnabled: rate.deskDeliveryEnabled,
            deskDeliveryPriceCents: rate.deskDeliveryEnabled ? rate.deskDeliveryPriceCents : null
          },
          create: {
            wilayaId: rate.wilayaId,
            homeDeliveryEnabled: rate.homeDeliveryEnabled,
            homeDeliveryPriceCents: rate.homeDeliveryEnabled ? rate.homeDeliveryPriceCents : null,
            deskDeliveryEnabled: rate.deskDeliveryEnabled,
            deskDeliveryPriceCents: rate.deskDeliveryEnabled ? rate.deskDeliveryPriceCents : null
          }
        })
      )
    )

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'WilayaShippingRate',
      entityId: 'bulk',
      metadata: { count: input.rates.length }
    })

    return this.listRates()
  }
}
