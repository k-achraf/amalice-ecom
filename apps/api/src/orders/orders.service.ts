import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { AbandonedLeadOrder, AcceptOrderUpsell, Checkout, CheckoutItem, LeadOrder, ShippingType } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { Product, ProductVariant, Prisma } from '../generated/prisma/client'
import { NotificationsService } from '../notifications/notifications.service'
import { AppsService } from '../apps/apps.service'
import { MetaConversionsApiService } from '../apps/meta-conversions-api.service'
import { TikTokEventsApiService } from '../apps/tiktok-events-api.service'
import { GoogleSheetsService } from '../apps/google-sheets.service'
import { OrderItemsService, canAddOrderItems } from '../order-items/order-items.service'

// Request-derived context for the pixel apps' server-side purchase events —
// never required, never validated beyond "is it a string": a missing or
// malformed value just means slightly worse ad-attribution match quality,
// not a broken order.
export interface OrderRequestContext {
  ip?: string
  userAgent?: string
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly apps: AppsService,
    private readonly metaConversions: MetaConversionsApiService,
    private readonly tiktokEvents: TikTokEventsApiService,
    private readonly orderItems: OrderItemsService,
    private readonly googleSheets: GoogleSheetsService
  ) {}

  // Server-side purchase events for both pixel apps' server-side APIs
  // (Meta's Conversions API, TikTok's Events API) — fire-and-forget by
  // design (see *ApiService.fireAndForget): either platform being slow or
  // down must never affect checkout. Each uses the SAME eventId the
  // storefront's browser pixel uses for its own purchase call (order.id,
  // when the caller didn't supply one) so each platform dedupes its browser
  // and server events into one instead of double-counting. The two calls
  // are independent — one app being disabled/misconfigured doesn't affect
  // the other.
  private sendPurchaseEvents(
    orderId: string,
    totalCents: number,
    phone: string,
    context: OrderRequestContext,
    tracking?: Checkout['tracking']
  ): void {
    const eventId = tracking?.eventId || orderId
    const valueDzd = totalCents / 100

    this.apps
      .getMetaPixelCapiCredentials()
      .then((credentials) => {
        if (!credentials) return
        this.metaConversions.fireAndForget(credentials, {
          eventName: 'Purchase',
          eventId,
          userData: { phone, ip: context.ip, userAgent: context.userAgent, fbp: tracking?.fbp, fbc: tracking?.fbc },
          customData: { value: valueDzd, currency: 'DZD', order_id: orderId }
        })
      })
      .catch(() => {
        // getMetaPixelCapiCredentials() only reads local config — a
        // rejection here means something is wrong with the DB read, not
        // with Meta. Swallow rather than propagate: this is still a
        // best-effort side channel, not part of the order's correctness.
      })

    this.apps
      .getTikTokPixelEapiCredentials()
      .then((credentials) => {
        if (!credentials) return
        this.tiktokEvents.fireAndForget(credentials, {
          eventName: 'CompletePayment',
          eventId,
          userData: { phone, ip: context.ip, userAgent: context.userAgent, ttp: tracking?.ttp },
          properties: { value: valueDzd, currency: 'DZD', content_id: orderId }
        })
      })
      .catch(() => {
        // Same rationale as the Meta branch above.
      })
  }

  // Google Sheets push — same fire-and-forget rule as sendPurchaseEvents
  // above: GoogleSheetsService itself already no-ops cheaply when the
  // feature is disabled/unconfigured, but a genuine Sheets API failure must
  // still never surface here as a broken checkout.
  private pushToGoogleSheets(orderId: string): void {
    this.googleSheets.pushOrderToSheets(orderId).catch((error: Error) => {
      this.logger.warn(`Google Sheets push failed for order ${orderId}: ${error.message}`)
    })
  }

  // Prices every checkout line server-side — never trusts a client-computed
  // total (SF-04). Prices off the selected ProductVariant (validated to
  // actually belong to the product) when item.variantId is set, otherwise
  // the base product — same "never trust the client" rule extends to which
  // variant's price applies, not just whether a discount is legitimate.
  // When an item names a ProductOffer, re-validates it actually belongs to
  // that product, is enabled, and that `quantity` matches exactly what the
  // offer requires (offers are picked as a whole card — see ProductOffer's
  // Prisma comment — not auto-detected from an arbitrary quantity) before
  // pricing off it instead of the regular unit price. Offer bundle pricing
  // is defined in terms of the base product's price (ProductOffer has no
  // per-variant bundle price), so a variant's own price is only used for
  // plain (non-offer) purchases. FreeShipping offers have no price effect
  // (no shipping-fee concept exists yet) — they still validate the quantity
  // match, but price like a plain purchase.
  private async priceCheckoutItems(items: CheckoutItem[], productById: Map<string, Product>, variantById: Map<string, ProductVariant>) {
    const offerIds = items.map((i) => i.offerId).filter((id): id is string => !!id)
    const offers = offerIds.length ? await this.prisma.productOffer.findMany({ where: { id: { in: offerIds } } }) : []
    const offerById = new Map(offers.map((o) => [o.id, o]))

    let totalCents = 0
    const pricedItems = items.map((item) => {
      const product = productById.get(item.productId)!
      const variant = item.variantId ? variantById.get(item.variantId) : undefined
      if (item.variantId && (!variant || variant.productId !== item.productId)) {
        throw new BadRequestException(`Selected variant is no longer available for "${product.name}"`)
      }
      const unitPriceCents = variant?.priceCents ?? product.priceCents
      let lineTotalCents = unitPriceCents * item.quantity
      let offerId: string | null = null

      if (item.offerId) {
        const offer = offerById.get(item.offerId)
        if (!offer || offer.productId !== item.productId || !offer.enabled) {
          throw new BadRequestException(`That offer is no longer available for "${product.name}"`)
        }
        const expectedQuantity = offer.type === 'BuyXGetYFree' ? offer.requiredQuantity + offer.freeQuantity : offer.requiredQuantity
        if (item.quantity !== expectedQuantity) {
          throw new BadRequestException(`Quantity doesn't match the selected offer for "${product.name}"`)
        }
        if (offer.type === 'FixedBundlePrice') {
          lineTotalCents = offer.bundlePriceCents ?? lineTotalCents
        } else if (offer.type === 'BuyXGetYFree') {
          lineTotalCents = product.priceCents * offer.requiredQuantity
        }
        offerId = offer.id
      }

      totalCents += lineTotalCents
      return {
        productId: item.productId,
        variantId: variant?.id ?? null,
        quantity: item.quantity,
        unitPriceCents,
        lineTotalCents,
        offerId
      }
    })

    return { pricedItems, totalCents }
  }

  // Shared by createOrder/createLeadOrder — fetches the variants named by
  // `variantId` on any item, keyed by id, so priceCheckoutItems and the
  // stock check/decrement below all resolve the same variant.
  private async loadVariants(items: CheckoutItem[]): Promise<Map<string, ProductVariant>> {
    const variantIds = items.map((i) => i.variantId).filter((id): id is string => !!id)
    if (!variantIds.length) return new Map()
    const variants = await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
    return new Map(variants.map((v) => [v.id, v]))
  }

  // Per-item stock check — variant stock is authoritative when the item has
  // one (see ProductVariant's Prisma comment), otherwise the base product's.
  private checkStock(item: CheckoutItem, product: Product, variantById: Map<string, ProductVariant>): void {
    const variant = item.variantId ? variantById.get(item.variantId) : undefined
    const available = variant?.stockQuantity ?? product.stockQuantity
    if (available < item.quantity) {
      throw new ConflictException(`Insufficient stock for "${product.name}"`)
    }
  }

  // Atomic conditional decrement — the WHERE clause makes the update itself
  // the concurrency check (see createOrder's original comment on this
  // pattern). Decrements the variant's own stock when the item has one,
  // otherwise the base product's — mirrors checkStock above.
  private async decrementStock(tx: Prisma.TransactionClient, item: CheckoutItem, variantById: Map<string, ProductVariant>): Promise<void> {
    if (item.variantId && variantById.has(item.variantId)) {
      const result = await tx.productVariant.updateMany({
        where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } }
      })
      if (result.count === 0) throw new ConflictException(`Insufficient stock for a product in this order`)
      return
    }
    const result = await tx.product.updateMany({
      where: { id: item.productId, stockQuantity: { gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } }
    })
    if (result.count === 0) throw new ConflictException(`Insufficient stock for a product in this order`)
  }

  // Prices delivery server-side from WilayaShippingRate — never trusts a
  // client-submitted shipping price (same rule as priceCheckoutItems above).
  // Re-validates the wilaya exists and that the requested type is actually
  // enabled with a price set; home and desk delivery are independent per
  // wilaya (see WilayaShippingRate's Prisma comment), so "wilaya exists"
  // alone isn't enough — the specific type must be enabled too.
  private async priceShipping(wilayaId: string, shippingType: ShippingType): Promise<{ priceCents: number; wilayaName: string }> {
    const wilaya = await this.prisma.wilaya.findUnique({ where: { id: wilayaId }, include: { shippingRate: true } })
    if (!wilaya) throw new BadRequestException('Selected wilaya not found')

    const rate = wilaya.shippingRate
    if (shippingType === 'Home') {
      if (!rate?.homeDeliveryEnabled || rate.homeDeliveryPriceCents == null) {
        throw new BadRequestException(`Home delivery isn't available for ${wilaya.name}`)
      }
      return { priceCents: rate.homeDeliveryPriceCents, wilayaName: wilaya.name }
    }
    if (!rate?.deskDeliveryEnabled || rate.deskDeliveryPriceCents == null) {
      throw new BadRequestException(`Desk delivery isn't available for ${wilaya.name}`)
    }
    return { priceCents: rate.deskDeliveryPriceCents, wilayaName: wilaya.name }
  }

  // Cart checkout — no OTP, goes straight through to call-center
  // confirmation like every other order (lands in PendingCallCenter). Stock
  // is decremented atomically in the same transaction as the order create,
  // same pattern as createLeadOrder below.
  async createOrder(checkout: Checkout, context: OrderRequestContext = {}) {
    const productIds = checkout.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))
    const variantById = await this.loadVariants(checkout.items)

    for (const item of checkout.items) {
      const product = productById.get(item.productId)
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`)
      this.checkStock(item, product, variantById)
    }

    const { pricedItems, totalCents: itemsTotalCents } = await this.priceCheckoutItems(checkout.items, productById, variantById)
    const { priceCents: shippingPriceCents } = await this.priceShipping(checkout.wilayaId, checkout.shippingType)
    const totalCents = itemsTotalCents + shippingPriceCents

    const customer = await this.prisma.customer.upsert({
      where: { phone: checkout.phone },
      update: checkout.name ? { name: checkout.name } : {},
      create: { phone: checkout.phone, name: checkout.name }
    })

    const address = await this.prisma.address.create({
      data: { ...checkout.address, customerId: customer.id }
    })

    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — the WHERE clause makes the update
      // itself the concurrency check. Two customers checking out the last
      // unit at once: exactly one UPDATE matches a row, the other's
      // `count` comes back 0, which is what actually prevents overselling
      // (not the earlier stock check above, which is just an early UX
      // rejection).
      for (const item of checkout.items) {
        await this.decrementStock(tx, item, variantById)
      }

      return tx.order.create({
        data: {
          customerId: customer.id,
          addressId: address.id,
          totalCents,
          shippingType: checkout.shippingType,
          shippingPriceCents,
          items: { create: pricedItems }
        },
        include: { items: true }
      })
    })

    await this.notifications.enqueue({
      channel: 'SMS',
      recipient: checkout.phone,
      message: `We've received your order! Our team will call you shortly to confirm the details. Total due on delivery: ${(totalCents / 100).toFixed(2)} DZD. Order ID: ${order.id}`,
      orderId: order.id
    })

    this.sendPurchaseEvents(order.id, totalCents, checkout.phone, context, checkout.tracking)
    this.pushToGoogleSheets(order.id)

    return order
  }

  // Lead-form order — still goes through call-center confirmation
  // like every other order (lands in PendingCallCenter, not Confirmed).
  // Maps wilaya/commune to the existing Address model (region=wilaya, city=commune).
  // Stock is decremented atomically in the same transaction as the order create.
  async createLeadOrder(lead: LeadOrder, context: OrderRequestContext = {}) {
    const productIds = lead.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))
    const variantById = await this.loadVariants(lead.items)

    for (const item of lead.items) {
      const product = productById.get(item.productId)
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`)
      this.checkStock(item, product, variantById)
    }

    const { pricedItems, totalCents: itemsTotalCents } = await this.priceCheckoutItems(lead.items, productById, variantById)
    const { priceCents: shippingPriceCents, wilayaName } = await this.priceShipping(lead.wilayaId, lead.shippingType)
    const totalCents = itemsTotalCents + shippingPriceCents

    // Extract core fields (name, phone, commune) from the dynamic fields
    // object; everything else goes into address.line2 as JSON. Wilaya comes
    // from the authoritative wilayaId above (priceShipping's lookup), not
    // trusted from the free-form fields map — same reasoning as
    // wilayaId/shippingType being separate typed fields on LeadOrderSchema.
    const f: Record<string, string> = lead.fields as Record<string, string>
    const name: string = f.name || f.fullName || ''
    const phone: string = f.phone || f.phoneNumber || ''
    const wilaya: string = wilayaName
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

    // If this submit is completing an order the storefront already
    // auto-created as abandoned (see createAbandonedOrder), update that same
    // row instead of creating a second one for one funnel visit — only if it
    // still exists, is still abandoned (not already converted/handled by
    // staff), and belongs to this same phone number (never let one phone's
    // submit silently overwrite another customer's abandoned order).
    const abandonedOrder = lead.convertsAbandonedOrderId
      ? await this.prisma.order.findUnique({ where: { id: lead.convertsAbandonedOrderId }, include: { customer: true } })
      : null
    const convertingAbandoned = !!abandonedOrder && abandonedOrder.isAbandoned && abandonedOrder.customer.phone === phone

    const order = await this.prisma.$transaction(async (tx) => {
      // Atomic stock decrement for each item
      for (const item of lead.items) {
        await this.decrementStock(tx, item, variantById)
      }

      if (convertingAbandoned) {
        await tx.orderItem.deleteMany({ where: { orderId: abandonedOrder!.id } })
        return tx.order.update({
          where: { id: abandonedOrder!.id },
          data: {
            addressId: address.id,
            totalCents,
            shippingType: lead.shippingType,
            shippingPriceCents,
            isAbandoned: false,
            items: { create: pricedItems }
          },
          include: { items: true }
        })
      }

      return tx.order.create({
        data: {
          customerId: customer.id,
          addressId: address.id,
          state: 'PendingCallCenter',
          totalCents,
          shippingType: lead.shippingType,
          shippingPriceCents,
          items: { create: pricedItems }
        },
        include: { items: true }
      })
    })

    // Enqueue notification
    await this.notifications.enqueue({
      channel: 'SMS',
      recipient: phone,
      message: `We've received your order! Our team will call you shortly to confirm the details. Total due on delivery: ${(totalCents / 100).toFixed(2)} DZD. Order ID: ${order.id}`,
      orderId: order.id
    })

    this.sendPurchaseEvents(order.id, totalCents, phone, context, lead.tracking)
    this.pushToGoogleSheets(order.id)

    return order
  }

  // Abandoned-cart order — fired by the storefront when a customer typed a
  // phone number on a lead form and went idle past the store's configured
  // delay without submitting (see AbandonedLeadOrderSchema). Deliberately
  // lighter-weight than createLeadOrder above: no stock decrement (nothing
  // is actually reserved for an incomplete cart — see Order.isAbandoned's
  // Prisma comment), no SMS ("we've received your order" would be premature
  // and confusing for something the customer never finished), and no ad
  // pixel Purchase events (would corrupt conversion/ROAS reporting for an
  // action that didn't happen). Stock decrement and pixel events DO fire
  // normally once/if createLeadOrder converts this row into a real order.
  async createAbandonedOrder(lead: AbandonedLeadOrder) {
    const productIds = lead.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } })
    const productById = new Map(products.map((p) => [p.id, p]))
    const variantById = await this.loadVariants(lead.items)

    for (const item of lead.items) {
      if (!productById.get(item.productId)) throw new NotFoundException(`Product ${item.productId} not found`)
    }

    const { pricedItems, totalCents: itemsTotalCents } = await this.priceCheckoutItems(lead.items, productById, variantById)

    // wilaya/shipping may not be picked yet — price it if we have both,
    // otherwise leave shipping unset rather than guessing.
    let shippingPriceCents = 0
    let wilayaName = ''
    if (lead.wilayaId && lead.shippingType) {
      const priced = await this.priceShipping(lead.wilayaId, lead.shippingType).catch(() => null)
      if (priced) {
        shippingPriceCents = priced.priceCents
        wilayaName = priced.wilayaName
      }
    }
    const totalCents = itemsTotalCents + shippingPriceCents

    const f: Record<string, string> = lead.fields as Record<string, string>
    const name: string = f.name || f.fullName || ''
    const phone: string = f.phone || f.phoneNumber || ''
    const commune: string = f.commune || f.city || ''
    if (!phone) throw new ConflictException('Phone is required')

    const coreKeys = new Set(['name', 'fullName', 'phone', 'phoneNumber', 'wilaya', 'region', 'commune', 'city'])
    const extras: Record<string, string> = {}
    for (const [key, val] of Object.entries(f)) {
      if (!coreKeys.has(key) && val) extras[key] = String(val)
    }

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: name ? { name } : {},
      create: { phone, name: name || null }
    })

    const address = await this.prisma.address.create({
      data: {
        customerId: customer.id,
        line1: commune || wilayaName || '(not provided)',
        city: commune,
        region: wilayaName,
        postalCode: '00000',
        country: 'DZ',
        line2: Object.keys(extras).length > 0 ? JSON.stringify(extras) : null
      }
    })

    return this.prisma.order.create({
      data: {
        customerId: customer.id,
        addressId: address.id,
        state: 'PendingCallCenter',
        totalCents,
        shippingType: lead.shippingType ?? null,
        shippingPriceCents,
        isAbandoned: true,
        items: { create: pricedItems }
      },
      include: { items: true }
    })
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
      shippingType: order.shippingType,
      shippingPriceCents: order.shippingPriceCents,
      createdAt: order.createdAt,
      trackingReference: order.shipment?.trackingReference ?? null
    }
  }

  // Phone is the shared secret — same trust model as trackOrder above, no
  // OTP/account system. Returns [] for an unknown phone rather than 404
  // (an unrecognized number just has no history, it isn't an error).
  async getHistory(phone: string) {
    return this.prisma.order.findMany({
      where: { customer: { phone } },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    })
  }

  // Upsells system — storefront post-checkout page. Same phone-as-shared-
  // secret trust model as trackOrder. Only one offer is ever shown (not a
  // list) — a post-checkout upsell page works because it's a single, easy
  // "yes/no" decision; turning it into a mini storefront defeats the point
  // and just adds friction right when the customer is about to leave.
  // Excludes upsells for products the order already contains — no point
  // suggesting something they just bought — and only looks at states an
  // item can actually still be added to (see OrderItemsService.canAddOrderItems).
  async getUpsellForOrder(orderId: string, phone: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true }
    })
    if (!order || order.customer.phone !== phone) throw new NotFoundException('Order not found')
    if (!canAddOrderItems(order.state)) return null

    const orderedProductIds = new Set(order.items.map((i) => i.productId))
    const candidates = await this.prisma.productUpsell.findMany({
      where: { productId: { in: [...orderedProductIds] }, enabled: true },
      include: { upsellProduct: { select: { id: true, name: true, slug: true, imageUrl: true, priceCents: true } } },
      orderBy: { createdAt: 'asc' }
    })
    const match = candidates.find((c) => !orderedProductIds.has(c.upsellProductId))
    if (!match) return null

    return {
      upsellId: match.id,
      product: match.upsellProduct,
      priceCents: match.priceCentsOverride ?? match.upsellProduct.priceCents
    }
  }

  async acceptUpsell(orderId: string, input: AcceptOrderUpsell) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } })
    if (!order || order.customer.phone !== input.phone) throw new NotFoundException('Order not found')

    const upsell = await this.prisma.productUpsell.findUnique({ where: { id: input.upsellId } })
    if (!upsell || !upsell.enabled) throw new NotFoundException('Upsell not found')

    return this.orderItems.addItem(
      orderId,
      {
        productId: upsell.upsellProductId,
        quantity: input.quantity,
        priceCentsOverride: upsell.priceCentsOverride ?? undefined,
        isUpsell: true
      },
      null
    )
  }
}
