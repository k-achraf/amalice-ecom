import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Checkout, LeadOrder } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { OtpService } from '../identity/otp/otp.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly notifications: NotificationsService
  ) {}

  async createOrder(checkout: Checkout) {
    const productIds = checkout.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))

    // Server-computed from live catalog data — the request never carries a
    // price. Stock is re-checked again atomically at confirm time (a
    // customer can sit on the OTP screen for minutes; PendingOTP doesn't
    // reserve inventory).
    let totalCents = 0
    for (const item of checkout.items) {
      const product = productById.get(item.productId)
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`)
      if (product.stockQuantity < item.quantity) {
        throw new ConflictException(`Insufficient stock for "${product.name}"`)
      }
      totalCents += product.priceCents * item.quantity
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone: checkout.phone },
      update: checkout.name ? { name: checkout.name } : {},
      create: { phone: checkout.phone, name: checkout.name }
    })

    const address = await this.prisma.address.create({
      data: { ...checkout.address, customerId: customer.id }
    })

    const order = await this.prisma.order.create({
      data: {
        customerId: customer.id,
        addressId: address.id,
        totalCents,
        items: {
          create: checkout.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: productById.get(item.productId)!.priceCents
          }))
        }
      },
      include: { items: true }
    })

    // Order exists in PendingOTP before the customer ever sees a code —
    // matches SF-08's "creates the order in PendingOTP, transitions to
    // Confirmed only after OTP verification."
    await this.otp.requestOtp(checkout.phone)

    return order
  }

  async confirmOrder(orderId: string, code: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, customer: true }
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.state !== 'PendingOTP') {
      throw new ConflictException(`Order is already ${order.state}`)
    }

    let verifyResult: Awaited<ReturnType<OtpService['verifyOtp']>>
    try {
      verifyResult = await this.otp.verifyOtp(order.customer.phone, code)
    } catch (error) {
      // Ties into RSK-01's future risk-scoring — for now, a structured log
      // line is the honest scope; a dedicated FailedOtpAttempt table is
      // that task's job, not this one's.
      this.logger.warn(`OTP verify failed for order ${orderId} (phone ${order.customer.phone})`)
      throw error
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          // Atomic conditional decrement — the WHERE clause makes the
          // update itself the concurrency check. Two customers confirming
          // the last unit at once: exactly one UPDATE matches a row, the
          // other's `count` comes back 0, which is what actually prevents
          // overselling (not the earlier stock check in createOrder, which
          // is just an early UX rejection).
          const result = await tx.product.updateMany({
            where: { id: item.productId, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } }
          })
          if (result.count === 0) {
            throw new ConflictException(`Insufficient stock for a product in this order`)
          }
        }
        await tx.order.update({ where: { id: orderId }, data: { state: 'Confirmed' } })
      })
    } catch (error) {
      // The transaction rolled back the stock changes, but the order
      // itself is a separate write — it needs its own update to reflect
      // that this order can never be confirmed as originally placed.
      await this.prisma.order.update({ where: { id: orderId }, data: { state: 'Cancelled' } })
      throw error
    }

    const confirmedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true }
    })

    await this.notifications.enqueue({
      channel: 'SMS',
      recipient: order.customer.phone,
      message: `Order confirmed! Total due on delivery: $${(order.totalCents / 100).toFixed(2)}. Order ID: ${orderId}`,
      orderId
    })

    return { token: verifyResult.token, order: confirmedOrder }
  }

  // Lead-form order — no OTP, creates a Confirmed order directly.
  // Maps wilaya/commune to the existing Address model (region=wilaya, city=commune).
  // Stock is decremented atomically in the same transaction as the order create.
  async createLeadOrder(lead: LeadOrder) {
    const productIds = lead.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))

    let totalCents = 0
    for (const item of lead.items) {
      const product = productById.get(item.productId)
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`)
      if (product.stockQuantity < item.quantity) {
        throw new ConflictException(`Insufficient stock for "${product.name}"`)
      }
      totalCents += product.priceCents * item.quantity
    }

    // Extract core fields (name, phone, wilaya, commune) from the dynamic
    // fields object; everything else goes into address.line2 as JSON.
    const f: Record<string, string> = lead.fields as Record<string, string>
    const name: string = f.name || f.fullName || ''
    const phone: string = f.phone || f.phoneNumber || ''
    const wilaya: string = f.wilaya || f.region || ''
    const commune: string = f.commune || f.city || ''

    if (!phone) throw new ConflictException('Phone is required')
    if (!name) throw new ConflictException('Name is required')

    // Collect extra (non-core) fields for storage
    const coreKeys = new Set(['name', 'fullName', 'phone', 'phoneNumber', 'wilaya', 'region', 'commune', 'city'])
    const extras: Record<string, string> = {}
    for (const [key, val] of Object.entries(f)) {
      if (!coreKeys.has(key) && val) extras[key] = String(val)
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: { name },
      create: { phone, name }
    })

    const address = await this.prisma.address.create({
      data: {
        customerId: customer.id,
        line1: commune || wilaya,
        city: commune,
        region: wilaya,
        postalCode: '00000',
        country: 'DZ',
        line2: Object.keys(extras).length > 0 ? JSON.stringify(extras) : null
      }
    })

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        // Atomic stock decrement for each item
        for (const item of lead.items) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } }
          })
          if (result.count === 0) {
            throw new ConflictException(`Insufficient stock for a product in this order`)
          }
        }

        return tx.order.create({
          data: {
            customerId: customer.id,
            addressId: address.id,
            state: 'Confirmed',
            totalCents,
            items: {
              create: lead.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPriceCents: productById.get(item.productId)!.priceCents
              }))
            }
          },
          include: { items: true }
        })
      })

      // Enqueue notification
      await this.notifications.enqueue({
        channel: 'SMS',
        recipient: phone,
        message: `Order confirmed! Total due on delivery: $${(totalCents / 100).toFixed(2)}. Order ID: ${order.id}`,
        orderId: order.id
      })

      return order
    } catch (error) {
      throw error
    }
  }

  async trackOrder(orderId: string, phone: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, shipment: true }
    })
    // Same 404 whether the order doesn't exist or the phone doesn't match —
    // a distinct "wrong phone" response would let someone confirm a real
    // order id exists just by trying phone numbers against it.
    if (!order || order.customer.phone !== phone) {
      throw new NotFoundException('Order not found')
    }
    return {
      id: order.id,
      state: order.state,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      trackingReference: order.shipment?.trackingReference ?? null
    }
  }

  async getHistory(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    })
  }
}
