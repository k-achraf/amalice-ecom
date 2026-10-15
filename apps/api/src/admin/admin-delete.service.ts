import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Permanent deletion — SuperAdmin only (enforced on the controller routes).
// Unlike archiving (Order.archived / the product "archive" action), this really
// removes rows, so every delete is written to the audit log with a snapshot of
// what was removed. Rows that other history depends on are handled explicitly:
// an order takes its items, shipment, reconciliation and ledger rows with it; a
// product that was ever ordered cannot be deleted (it would corrupt those
// orders) and must be hidden/archived instead.
@Injectable()
export class AdminDeleteService {
  private readonly logger = new Logger(AdminDeleteService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async deleteOrder(id: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: { select: { phone: true, name: true } }, items: { include: { product: { select: { name: true } } } }, shipment: true }
    })
    if (!order) throw new NotFoundException('Order not found')

    await this.prisma.$transaction(async (tx) => {
      await tx.callAttempt.deleteMany({ where: { orderId: id } })
      await tx.notification.deleteMany({ where: { orderId: id } })
      await tx.ledgerEntry.deleteMany({ where: { orderId: id } })
      await tx.cashReconciliation.deleteMany({ where: { orderId: id } })
      await tx.shipment.deleteMany({ where: { orderId: id } })
      await tx.googleSheetOrderRow.deleteMany({ where: { orderId: id } })
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })

    await this.audit.log({
      actor,
      action: 'Delete',
      entity: 'Order',
      entityId: id,
      metadata: {
        state: order.state,
        totalCents: order.totalCents,
        customer: { name: order.customer.name, phone: order.customer.phone },
        items: order.items.map((i) => ({ product: i.product.name, quantity: i.quantity })),
        trackingReference: order.shipment?.trackingReference ?? null,
        // A parcel already created at a courier is NOT removed there.
        hadCourierShipment: !!order.shipment
      }
    })
    return { id, deleted: true }
  }

  async deleteOrders(ids: string[], actor: AuditActor) {
    const deleted: string[] = []
    const failed: { id: string; reason: string }[] = []
    for (const id of ids) {
      try {
        await this.deleteOrder(id, actor)
        deleted.push(id)
      } catch (error) {
        failed.push({ id, reason: (error as Error).message })
      }
    }
    return { deleted, failed }
  }

  async deleteProduct(id: string, actor: AuditActor) {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true, name: true, slug: true } })
    if (!product) throw new NotFoundException('Product not found')

    const orderCount = await this.prisma.orderItem.count({ where: { productId: id } })
    if (orderCount > 0) {
      throw new ConflictException(`“${product.name}” appears in ${orderCount} order line(s). Deleting it would break those orders — hide/archive the product instead, or delete those orders first.`)
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockAdjustment.deleteMany({ where: { productId: id } })
      // Variants, images, offers, upsells, attributes, reviews, landing pages,
      // funnels and sheet links are removed by their ON DELETE CASCADE.
      await tx.product.delete({ where: { id } })
    })
    await this.audit.log({ actor, action: 'Delete', entity: 'Product', entityId: id, metadata: { name: product.name, slug: product.slug } })
    return { id, deleted: true }
  }

  // A customer with orders is only deleted with withOrders=true, which deletes
  // each of those orders too (see deleteOrder).
  async deleteCustomer(id: string, withOrders: boolean, actor: AuditActor) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { id: true, name: true, phone: true } })
    if (!customer) throw new NotFoundException('Customer not found')

    const orders = await this.prisma.order.findMany({ where: { customerId: id }, select: { id: true } })
    if (orders.length && !withOrders) {
      throw new ConflictException(`This customer has ${orders.length} order(s). Delete with their orders, or delete/archive the orders first.`)
    }
    for (const o of orders) await this.deleteOrder(o.id, actor)

    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } })
      await tx.address.deleteMany({ where: { customerId: id } })
      await tx.customer.delete({ where: { id } })
    })
    await this.audit.log({ actor, action: 'Delete', entity: 'Customer', entityId: id, metadata: { name: customer.name, phone: customer.phone, ordersDeleted: orders.length } })
    return { id, deleted: true, ordersDeleted: orders.length }
  }

  async deleteAdminUser(id: string, actor: AuditActor) {
    if (id === actor.id) throw new BadRequestException('You cannot delete your own account.')
    const user = await this.prisma.adminUser.findUnique({ where: { id }, include: { role: { select: { name: true } } } })
    if (!user) throw new NotFoundException('Admin user not found')
    if (user.role.name === 'SuperAdmin') {
      const others = await this.prisma.adminUser.count({ where: { id: { not: id }, active: true, role: { name: 'SuperAdmin' } } })
      if (others === 0) throw new BadRequestException('This is the last active SuperAdmin — it cannot be deleted.')
    }
    await this.prisma.adminUser.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'AdminUser', entityId: id, metadata: { email: user.email, role: user.role.name } })
    return { id, deleted: true }
  }
}
