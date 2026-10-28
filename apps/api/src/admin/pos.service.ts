import { Injectable } from '@nestjs/common'
import { POS_SOURCES, type PosProduct, type PosRecentOrder } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

// Read side of the POS page: the product picker (for staff roles that cannot open the catalogue
// screens) and the latest POS orders.
@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async products(search?: string): Promise<PosProduct[]> {
    const term = search?.trim()
    const rows = await this.prisma.product.findMany({
      where: { ...(term && { name: { contains: term, mode: 'insensitive' as const } }) },
      orderBy: { name: 'asc' },
      take: 30,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        priceCents: true,
        stockQuantity: true,
        variants: {
          orderBy: { sku: 'asc' },
          select: { id: true, sku: true, priceCents: true, stockQuantity: true, options: { select: { option: { select: { value: true, displayValue: true } } } } }
        }
      }
    })
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      priceCents: p.priceCents,
      stockQuantity: p.stockQuantity,
      variants: p.variants.map((v) => {
        const parts = v.options.map((o) => o.option.displayValue ?? o.option.value)
        return { id: v.id, label: parts.length ? parts.join(' / ') : v.sku, sku: v.sku, priceCents: v.priceCents, stockQuantity: v.stockQuantity }
      })
    }))
  }

  async recent(limit = 15): Promise<PosRecentOrder[]> {
    const rows = await this.prisma.order.findMany({
      where: { attribution: { is: { channel: 'pos' } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        state: true,
        totalCents: true,
        customer: { select: { name: true, phone: true } },
        address: { select: { region: true, city: true } },
        attribution: { select: { utmSource: true, utmCampaign: true } },
        items: { select: { quantity: true, product: { select: { name: true } } } }
      }
    })
    return rows.map((o) => {
      const first = o.items[0]
      const more = o.items.length - 1
      return {
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        state: o.state,
        customerName: o.customer.name,
        phone: o.customer.phone,
        region: o.address.region,
        city: o.address.city,
        totalCents: o.totalCents,
        source: POS_SOURCES.find((s) => s.id === o.attribution?.utmSource)?.label ?? o.attribution?.utmSource ?? null,
        sourceNote: o.attribution?.utmCampaign ?? null,
        itemsLabel: first ? `${first.quantity} × ${first.product.name}${more > 0 ? ` +${more}` : ''}` : ''
      }
    })
  }
}
