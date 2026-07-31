import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Commune, Wilaya } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

// Algeria wilayas/communes — read-only reference data backing the storefront
// lead form's cascading wilaya/commune selects (see schema.prisma's
// Wilaya/Commune model comments for provenance). No admin CRUD: this data is
// seeded once and only changes via a fresh vendor + reseed.
@ApiTags('locations')
@Controller()
export class LocationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('wilayas')
  async listWilayas(): Promise<Wilaya[]> {
    // Alphabetical, not by id — id is a numeric-looking string ("1".."69")
    // and sorts lexicographically (1, 10, 11, 12, 2, ...) rather than
    // numerically, which reads as broken in a dropdown.
    const rows = await this.prisma.wilaya.findMany({
      orderBy: { name: 'asc' },
      include: { shippingRate: true }
    })
    // A wilaya with no rate row yet (the default, until an admin configures
    // one) comes back with both delivery types disabled rather than an
    // error — the wilaya itself is always listed, only its shipping options
    // are empty.
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      homeDeliveryEnabled: w.shippingRate?.homeDeliveryEnabled ?? false,
      homeDeliveryPriceCents: w.shippingRate?.homeDeliveryPriceCents ?? null,
      deskDeliveryEnabled: w.shippingRate?.deskDeliveryEnabled ?? false,
      deskDeliveryPriceCents: w.shippingRate?.deskDeliveryPriceCents ?? null
    }))
  }

  // wilayaId is required — 1708 communes is too many to hand back
  // unfiltered, and the storefront always has a selected wilaya before it
  // needs a commune list.
  @Get('communes')
  async listCommunes(@Query('wilayaId') wilayaId?: string): Promise<Commune[]> {
    if (!wilayaId) throw new BadRequestException('wilayaId query parameter is required')
    return this.prisma.commune.findMany({ where: { wilayaId }, orderBy: { name: 'asc' } })
  }
}
