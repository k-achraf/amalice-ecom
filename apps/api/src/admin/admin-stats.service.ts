import { Injectable } from '@nestjs/common'
import type { DashboardStats } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

// ADM-09 — operations dashboard KPIs. One query per metric rather than one
// giant aggregate: each is independently readable and the dashboard can
// render incrementally. Sourced from real Order/Product data, not placeholder
// numbers (the existing placeholder index.vue is replaced by this).
@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(): Promise<DashboardStats> {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      ordersToday,
      codPendingAgg,
      codCollectedAgg,
      pendingCallCenterCount,
      confirmedCount,
      packedCount,
      deliveriesToday,
      rtoCount30d,
      totalOrders30d,
      lowStockProducts
    ] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      // COD "pending" = total of orders not yet at CashCollected/Reconciled/Settled.
      this.prisma.order.aggregate({
        where: { state: { in: ['Confirmed', 'Packed', 'HandedToCourier', 'OutForDelivery', 'Delivered'] } },
        _sum: { totalCents: true }
      }),
      this.prisma.order.aggregate({
        where: { state: { in: ['CashCollected', 'Reconciled', 'Settled'] } },
        _sum: { totalCents: true }
      }),
      this.prisma.order.count({ where: { state: { in: ['PendingCallCenter', 'CallCenterNoAnswer'] } } }),
      this.prisma.order.count({ where: { state: 'Confirmed' } }),
      this.prisma.order.count({ where: { state: 'Packed' } }),
      this.prisma.order.count({
        where: { state: 'Delivered', updatedAt: { gte: startOfToday } }
      }),
      this.prisma.order.count({
        where: { state: { in: ['ReturnedToOrigin', 'Restocked' as never] }, createdAt: { gte: thirtyDaysAgo } }
      }),
      this.prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.product.count({
        where: { stockQuantity: { lte: this.prisma.product.fields.lowStockThreshold } }
      })
    ])

    return {
      ordersToday,
      codAmountPendingCents: codPendingAgg._sum.totalCents ?? 0,
      codAmountCollectedCents: codCollectedAgg._sum.totalCents ?? 0,
      pendingCallCenterCount,
      confirmedCount,
      packedCount,
      deliveriesToday,
      rtoCount30d,
      totalOrders30d,
      lowStockCount: lowStockProducts
    }
  }

  // ADM-10 — customers. PII scoping (masking phone except Support/Ops) is the
  // controller's job per plan §11 — the service returns full rows and the
  // controller masks based on the requesting role.
  async listCustomers(args: { search?: string; page: number; pageSize: number }) {
    const where = args.search
      ? {
          OR: [
            { phone: { contains: args.search, mode: 'insensitive' as const } },
            { name: { contains: args.search, mode: 'insensitive' as const } }
          ]
        }
      : {}
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.customer.count({ where })
    ])

    // Order count + total value per customer — one extra aggregate pass per
    // customer page (page sizes are small, this is fine).
    const withStats = await Promise.all(
      items.map(async (c) => {
        const agg = await this.prisma.order.aggregate({
          where: { customerId: c.id },
          _sum: { totalCents: true },
          _count: true
        })
        return {
          id: c.id,
          phone: c.phone,
          name: c.name,
          orderCount: agg._count,
          totalValueCents: agg._sum.totalCents ?? 0,
          createdAt: c.createdAt.toISOString()
        }
      })
    )
    return { items: withStats, total, page: args.page, pageSize: args.pageSize }
  }

  async findCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: { select: { name: true, slug: true } } } } },
          take: 50
        }
      }
    })
    return customer
  }
}
