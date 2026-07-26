import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { CreateReview, RatingSummary, Review } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlugOrThrow(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } })
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  // SF-16 — public list of approved reviews for a product + the aggregate
  // rating summary (average, count, 1–5 distribution). Unapproved reviews
  // never surface to the storefront; the admin (ADM-07) moderates them.
  async listApproved(productId: string): Promise<Review[]> {
    const rows = await this.prisma.review.findMany({
      where: { productId, approved: true },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      customerId: r.customerId,
      rating: r.rating,
      title: r.title,
      body: r.body,
      approved: r.approved,
      createdAt: r.createdAt.toISOString(),
      customerName: r.customer.name
    }))
  }

  async ratingSummary(productId: string): Promise<RatingSummary> {
    const rows = await this.prisma.review.findMany({
      where: { productId, approved: true },
      select: { rating: true }
    })
    if (rows.length === 0) {
      return { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    }
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
    let sum = 0
    for (const r of rows) {
      sum += r.rating
      distribution[r.rating as 1 | 2 | 3 | 4 | 5]++
    }
    return { average: sum / rows.length, count: rows.length, distribution }
  }

  // SF-16 anti-spam: only customers with a Delivered order containing this
  // product can review it. Verified server-side against OrderItem history —
  // not self-attested. COD's phone-OTP identity makes this tractable without
  // a separate account system.
  async create(productId: string, customerId: string, input: CreateReview): Promise<Review> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')

    const hasDelivered = await this.prisma.order.findFirst({
      where: {
        customerId,
        state: 'Delivered',
        items: { some: { productId } }
      },
      select: { id: true }
    })
    if (!hasDelivered) {
      throw new ForbiddenException('You can only review products you have had delivered')
    }

    // One review per customer+product — enforced structurally (unique
    // constraint in schema). The catch below turns the P2002 into a 409
    // rather than a raw 500.
    try {
      const review = await this.prisma.review.create({
        data: {
          productId,
          customerId,
          rating: input.rating,
          title: input.title,
          body: input.body,
          approved: false // no auto-publish — admin moderates (ADM-07)
        }
      })
      return {
        id: review.id,
        productId: review.productId,
        customerId: review.customerId,
        rating: review.rating,
        title: review.title,
        body: review.body,
        approved: review.approved,
        createdAt: review.createdAt.toISOString()
      }
    } catch (error) {
      if (
        error != null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product')
      }
      throw error
    }
  }
}
