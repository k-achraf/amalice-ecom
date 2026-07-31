import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { NormalizedCourierStatus } from './courier-provider.interface'
import { CourierProvider, COURIER_PROVIDER } from './courier-provider.interface'
import { isValidTransition } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Maps the courier's normalized status onto the order lifecycle (plan §7).
// This is the single place that translation happens — COU-04's "one code path
// for admin-changed and courier-told" rule. Both the webhook handler and the
// admin manual-transition path funnel through here for status writes.
const STATUS_TO_ORDER_STATE: Record<NormalizedCourierStatus, string | null> = {
  created: null, // shipment created, but order stays HandedToCourier (set on createShipment)
  picked_up: 'HandedToCourier',
  in_transit: 'HandedToCourier',
  out_for_delivery: 'OutForDelivery',
  delivered: 'Delivered',
  delivery_failed: 'DeliveryFailed',
  returned: 'ReturnedToOrigin',
  cancelled: 'Cancelled'
}

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(COURIER_PROVIDER) private readonly courier: CourierProvider
  ) {}

  // COU-03 — create the shipment when an order is dispatched. Looks up the
  // default courier (the first one; multi-courier assignment is ADM-13). On
  // success, order → HandedToCourier + the tracking reference is stored.
  async createShipmentForOrder(orderId: string, actor: AuditActor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, address: true, shipment: true, items: { include: { product: true } } }
    })
    if (!order) throw new NotFoundException('Order not found')
    if (order.state !== 'Packed') {
      throw new BadRequestException(`Order must be Packed to dispatch (currently ${order.state})`)
    }
    if (order.shipment) {
      throw new BadRequestException('Shipment already exists for this order')
    }

    // The first courier is the default in v1 — real multi-courier assignment
    // is ADM-13's job. If no couriers exist, the seed (which creates
    // FastShip) must be run.
    const courier = await this.prisma.courier.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!courier) throw new BadRequestException('No courier configured')

    const result = await this.courier.createShipment({
      orderId: order.id,
      address: {
        line1: order.address.line1,
        line2: order.address.line2,
        city: order.address.city,
        region: order.address.region,
        postalCode: order.address.postalCode,
        country: order.address.country
      },
      recipientName: order.customer.name,
      recipientPhone: order.customer.phone,
      codAmountCents: order.totalCents
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.create({
        data: {
          orderId: order.id,
          courierId: courier.id,
          trackingReference: result.trackingReference,
          courierStatus: result.courierStatus
        }
      })
      await tx.order.update({ where: { id: orderId }, data: { state: 'HandedToCourier' } })
    })

    await this.audit.log({
      actor,
      action: 'StateTransition',
      entity: 'Order',
      entityId: orderId,
      metadata: { from: 'Packed', to: 'HandedToCourier', trackingReference: result.trackingReference, courier: courier.name }
    })

    return { orderId, trackingReference: result.trackingReference, courierStatus: result.courierStatus }
  }

  // COU-04 — apply a courier status update through the SAME transition logic
  // admin uses. The webhook controller calls this after authenticating;
  // idempotent (re-applying the same status is a no-op). Out-of-order
  // deliveries can't break the state machine — isValidTransition gates it.
  async applyCourierStatus(trackingReference: string, normalizedStatus: NormalizedCourierStatus) {
    // trackingReference is nullable (not @unique), so findFirst not findUnique.
    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingReference },
      include: { order: true }
    })
    if (!shipment) {
      this.logger.warn(`Webhook for unknown tracking reference: ${trackingReference}`)
      return { applied: false, reason: 'unknown tracking reference' }
    }

    const targetState = STATUS_TO_ORDER_STATE[normalizedStatus]
    if (!targetState) {
      // 'created'/'picked_up'/'in_transit' map to HandedToCourier — already set.
      return { applied: false, reason: `status ${normalizedStatus} does not advance the order` }
    }

    const from = shipment.order.state
    if (from === targetState) {
      return { applied: false, reason: `order already ${from}` }
    }
    if (!isValidTransition(from as never, targetState as never)) {
      this.logger.warn(
        `Webhook would cause illegal transition ${from} → ${targetState} for order ${shipment.order.id}; ignoring`
      )
      return { applied: false, reason: `illegal transition ${from} → ${targetState}` }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { courierStatus: normalizedStatus }
      })
      await tx.order.update({ where: { id: shipment.order.id }, data: { state: targetState as never } })
    })

    await this.audit.log({
      action: 'StateTransition',
      entity: 'Order',
      entityId: shipment.order.id,
      metadata: { from, to: targetState, source: 'courier-webhook', trackingReference }
    })

    return { applied: true, from, to: targetState }
  }
}
