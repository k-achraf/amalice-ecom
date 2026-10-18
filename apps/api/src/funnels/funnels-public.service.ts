import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  BrandSchema,
  LandingSettingsSchema,
  defaultLandingSettings,
  withDescriptionSection,
  offerTotalQuantity,
  type AcceptFunnelOffer,
  type FunnelOrder,
  type FunnelOrderResult,
  type FunnelStepConfig,
  type FunnelStepType,
  type LandingSettings,
  type ProductFaq,
  type ProductSpecification,
  type PublicFunnel,
  type PublicFunnelStep
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { OrdersService, type OrderRequestContext } from '../orders/orders.service'
import { OrderItemsService } from '../order-items/order-items.service'

const OFFER_STEPS: FunnelStepType[] = ['Upsell', 'Downsell', 'OrderBump']

// The public side of funnels — what the standalone funnels site (apps/funnels) reads and writes.
// Only Live funnels are ever served; a draft or paused funnel is a plain 404 to the public.
// Every price is computed here, never trusted from the browser.
@Injectable()
export class FunnelsPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly orderItems: OrderItemsService
  ) {}

  async get(slug: string): Promise<PublicFunnel> {
    const funnel = await this.loadLive(slug)
    const product = funnel.product

    const enabledSteps = funnel.steps.filter((s) => s.enabled)
    const offerIds = enabledSteps.map((s) => (s.config as FunnelStepConfig | null)?.offerProductId).filter((v): v is string => !!v)
    const offerProducts = offerIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: offerIds } }, select: { id: true, name: true, imageUrl: true, priceCents: true } })
      : []
    const offerById = new Map(offerProducts.map((p) => [p.id, p]))

    const steps: PublicFunnelStep[] = enabledSteps.map((s) => {
      const cfg = (s.config ?? {}) as FunnelStepConfig
      const op = cfg.offerProductId ? offerById.get(cfg.offerProductId) : undefined
      return {
        id: s.id,
        type: s.type as FunnelStepType,
        name: s.name,
        headline: cfg.headline ?? null,
        offerProduct: op ? { id: op.id, name: op.name, imageUrl: op.imageUrl, priceCents: cfg.priceCentsOverride ?? op.priceCents, normalPriceCents: op.priceCents } : null
      }
    })
    // An offer step with no product configured can't be shown; drop it rather than render an empty offer.
    const usable = steps.filter((s) => !OFFER_STEPS.includes(s.type) || s.offerProduct)

    const landingStep = enabledSteps.find((s) => s.type === 'Landing')
    const rawLanding = (landingStep?.config as FunnelStepConfig | null)?.landing
    const parsed = rawLanding ? LandingSettingsSchema.safeParse(rawLanding) : null
    // No landing step ("Quick order") → a compact page: photos, title, form — and the
    // product description right below the form, so a visitor can still read about
    // the product before ordering.
    const fallback = defaultLandingSettings(landingStep ? 'classic' : 'compact')
    const landing: LandingSettings = withDescriptionSection(parsed?.success ? parsed.data : fallback)

    let generatedImageUrl: string | null = null
    if (landing.generatedPageId) {
      const page = await this.prisma.productLandingPage.findFirst({ where: { id: landing.generatedPageId, productId: product.id }, select: { finalImageUrl: true } })
      generatedImageUrl = page?.finalImageUrl ?? null
    }

    const [wilayas, settings, meta, tiktok, reviewRows, ratingAgg] = await Promise.all([
      this.prisma.wilaya.findMany({ orderBy: { name: 'asc' }, include: { shippingRate: true } }),
      this.prisma.storeSettings.findUnique({ where: { id: 'singleton' }, select: { storeName: true, abandonedCartDelaySeconds: true, brand: true } }),
      this.prisma.appInstallation.findUnique({ where: { appId: 'meta-pixel' } }),
      this.prisma.appInstallation.findUnique({ where: { appId: 'tiktok-pixel' } }),
      this.prisma.review.findMany({
        where: { productId: product.id, approved: true },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { customer: { select: { name: true } } }
      }),
      this.prisma.review.aggregate({ where: { productId: product.id, approved: true }, _avg: { rating: true }, _count: { _all: true } })
    ])

    // A funnel's own pixel wins over the store-wide one (and works even if the store-wide app is off).
    const metaPixelId = funnel.metaPixelId ?? (meta?.enabled ? ((meta.config as { pixelId?: string } | null)?.pixelId ?? null) : null)
    const tiktokPixelCode = funnel.tiktokPixelCode ?? (tiktok?.enabled ? ((tiktok.config as { pixelCode?: string } | null)?.pixelCode ?? null) : null)

    return {
      id: funnel.id,
      slug: funnel.slug,
      name: funnel.name,
      storeName: settings?.storeName ?? 'Amalice',
      brand: settings?.brand ? (BrandSchema.safeParse(settings.brand).data ?? null) : null,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        imageUrl: product.imageUrl,
        images: product.images.map((i) => ({ url: i.url, altText: i.altText })),
        keyBenefits: product.keyBenefits,
        faqs: (product.faqs as ProductFaq[] | null) ?? [],
        specifications: (product.specifications as ProductSpecification[] | null) ?? [],
        offers: product.offers.map((o) => ({
          id: o.id,
          type: o.type,
          requiredQuantity: o.requiredQuantity,
          freeQuantity: o.freeQuantity,
          bundlePriceCents: o.bundlePriceCents
        })),
        requireOfferSelection: product.requireOfferSelection,
        variants: product.variants.map((v) => ({
          id: v.id,
          label: v.options.map((o) => o.option.value).join(' / ') || v.sku,
          priceCents: v.priceCents,
          stockQuantity: v.stockQuantity
        }))
      },
      reviews: reviewRows
        .map((r) => ({ rating: r.rating, text: (r.body || r.title || '').trim(), author: (r.customer.name ?? '').trim().split(/\s+/)[0] ?? '' }))
        .filter((r) => r.text)
        .slice(0, 6),
      rating: ratingAgg._count._all > 0 && ratingAgg._avg.rating ? { avg: Math.round(ratingAgg._avg.rating * 10) / 10, count: ratingAgg._count._all } : null,
      steps: usable,
      landing,
      generatedImageUrl,
      pixels: { metaPixelId, tiktokPixelCode },
      abandonedDelaySeconds: settings?.abandonedCartDelaySeconds ?? 60,
      // Only wilayas the admin has priced for at least one delivery type: a visitor can't order to the rest.
      wilayas: wilayas
        .map((w) => ({
          id: w.id,
          name: w.name,
          homePriceCents: w.shippingRate?.homeDeliveryEnabled ? (w.shippingRate.homeDeliveryPriceCents ?? null) : null,
          deskPriceCents: w.shippingRate?.deskDeliveryEnabled ? (w.shippingRate.deskDeliveryPriceCents ?? null) : null
        }))
        .filter((w) => w.homePriceCents !== null || w.deskPriceCents !== null)
    }
  }

  async placeOrder(slug: string, input: FunnelOrder, context: OrderRequestContext): Promise<FunnelOrderResult> {
    const funnel = await this.loadLive(slug)
    const product = funnel.product

    let quantity = input.quantity
    if (input.offerId) {
      const offer = product.offers.find((o) => o.id === input.offerId)
      if (!offer) throw new BadRequestException('That offer is no longer available')
      quantity = offerTotalQuantity(offer)
    }
    if (input.variantId && !product.variants.some((v) => v.id === input.variantId)) {
      throw new BadRequestException('Selected variant not found for this product')
    }

    let bump: { productId: string; priceCents: number } | null = null
    if (input.bumpStepId) {
      const step = funnel.steps.find((s) => s.id === input.bumpStepId && s.enabled && s.type === 'OrderBump')
      const cfg = (step?.config ?? {}) as FunnelStepConfig
      if (!step || !cfg.offerProductId) throw new BadRequestException('That add-on is no longer available')
      const bumpProduct = await this.prisma.product.findUnique({ where: { id: cfg.offerProductId }, select: { id: true, priceCents: true } })
      if (!bumpProduct) throw new BadRequestException('That add-on is no longer available')
      bump = { productId: bumpProduct.id, priceCents: cfg.priceCentsOverride ?? bumpProduct.priceCents }
    }

    // The funnel only ever sells its own product: the items are built here, not taken from the request.
    const order = await this.orders.createLeadOrder(
      {
        fields: input.fields,
        wilayaId: input.wilayaId,
        shippingType: input.shippingType,
        items: [{ productId: product.id, variantId: input.variantId, quantity, offerId: input.offerId }],
        tracking: input.tracking,
        idempotencyKey: input.idempotencyKey,
        formLoadedAt: input.formLoadedAt,
        convertsAbandonedOrderId: input.convertsAbandonedOrderId
      },
      { ...context, funnelId: funnel.id }
    )

    if (bump) await this.addOfferItem(order.id, bump.productId, bump.priceCents)
    return this.result(order.id)
  }

  async acceptOffer(slug: string, orderId: string, stepId: string, input: AcceptFunnelOffer): Promise<FunnelOrderResult> {
    const funnel = await this.loadLive(slug)
    const step = funnel.steps.find((s) => s.id === stepId && s.enabled && (s.type === 'Upsell' || s.type === 'Downsell'))
    const cfg = (step?.config ?? {}) as FunnelStepConfig
    if (!step || !cfg.offerProductId) throw new NotFoundException('Offer not found')

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } })
    if (!order || order.customer.phone !== input.phone) throw new NotFoundException('Order not found')

    const product = await this.prisma.product.findUnique({ where: { id: cfg.offerProductId }, select: { id: true, priceCents: true } })
    if (!product) throw new NotFoundException('Offer not found')
    await this.addOfferItem(orderId, product.id, cfg.priceCentsOverride ?? product.priceCents)
    return this.result(orderId)
  }

  // Idempotent: tapping "add" twice (or a retry) never adds the line twice.
  private async addOfferItem(orderId: string, productId: string, priceCents: number) {
    const existing = await this.prisma.orderItem.findFirst({ where: { orderId, productId, isUpsell: true }, select: { id: true } })
    if (existing) return
    await this.orderItems.addItem(orderId, { productId, quantity: 1, priceCentsOverride: priceCents, isUpsell: true }, null)
  }

  private async result(orderId: string): Promise<FunnelOrderResult> {
    const o = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, totalCents: true } })
    return { id: o.id, totalCents: o.totalCents }
  }

  private async loadLive(slug: string) {
    const funnel = await this.prisma.funnel.findUnique({
      where: { slug },
      include: {
        steps: { orderBy: { position: 'asc' } },
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            offers: { where: { enabled: true }, orderBy: { requiredQuantity: 'asc' } },
            variants: { include: { options: { include: { option: true } } } }
          }
        }
      }
    })
    if (!funnel || funnel.status !== 'Live') throw new NotFoundException('Funnel not found')
    return funnel
  }
}
