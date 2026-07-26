import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { OrderState } from '@amalice/shared'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { isValidTransition } from '../common/order-transitions'

// ADM-04/ADM-05 — the admin-side order read/transition API. Distinct from
// the public OrdersService (which owns checkout/confirm/track): this is the
// ops-staff surface for the order queue and manual state transitions. Both
// consult the same VALID_TRANSITIONS map so admin and webhook-driven changes
// can't diverge (COU-04).
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(args: {
    state?: OrderState
    search?: string
    courierId?: string
    from?: Date
    to?: Date
    page: number
    pageSize: number
  }) {
    const where: Prisma.OrderWhereInput = {
      ...(args.state && { state: args.state }),
      ...(args.courierId && { shipment: { courierId: args.courierId } }),
      ...((args.from || args.to) && {
        createdAt: { ...(args.from && { gte: args.from }), ...(args.to && { lte: args.to }) }
      }),
      ...(args.search && {
        OR: [
          { id: { equals: args.search, mode: 'insensitive' } },
          { customer: { phone: { contains: args.search, mode: 'insensitive' } } },
          { customer: { name: { contains: args.search, mode: 'insensitive' } } }
        ]
      })
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { include: { product: { select: { name: true, slug: true } } } },
          shipment: { include: { courier: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.order.count({ where })
    ])
    return { items, total, page: args.page, pageSize: args.pageSize }
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        address: true,
        items: { include: { product: { select: { id: true, name: true, slug: true, imageUrl: true } } } },
        shipment: { include: { courier: true } },
        cashReconciliation: true,
        notifications: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    })
    if (!order) throw new NotFoundException('Order not found')
    return order
  }

  // ADM-05 — manual state transition. Re-validates against the state machine
  // server-side (client-side gating is UX only). Every transition is
  // audit-logged with from/to (SEC-03). Rejecting illegal transitions here
  // means the UI can't bypass the machine even if it tried.
  async transition(id: string, to: OrderState, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({ where: { id } })
    if (!order) throw new NotFoundException('Order not found')
    const from = order.state
    if (from === to) throw new BadRequestException(`Order is already ${to}`)
    if (!isValidTransition(from, to)) {
      throw new BadRequestException(`Illegal transition: ${from} → ${to}`)
    }

    await this.prisma.order.update({ where: { id }, data: { state: to } })
    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: id,
      metadata: { from, to }
    })
    return this.findOne(id)
  }
}
