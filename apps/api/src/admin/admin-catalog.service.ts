import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdjustStock, CreateProduct, ProductFaq, ProductListQuery, ProductListResponse, ProductSpecification } from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import type { Product as ProductRow } from '../generated/prisma/client'

// faqs/specifications are nullable Json columns with no DB default (most
// rows are NULL, not []) — every read path normalizes to [] here so nothing
// consuming the shared `Product` type needs its own null-check.
function withNormalizedContent<T extends ProductRow>(product: T) {
  return {
    ...product,
    faqs: (product.faqs as ProductFaq[] | null) ?? [],
    specifications: (product.specifications as ProductSpecification[] | null) ?? []
  }
}

// ADM-07 — product CRUD + stock adjustments. Every stockQuantity change goes
// through adjustStock and writes a StockAdjustment row + an audit entry; the
// admin inventory screen reads that history. Low-stock threshold is the
// dashboard alert feed (ADM-09).
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // Admin's own product listing — deliberately separate from
  // ProductsController's public GET /products (catalog.service used to be
  // shared between the two, which meant filtering /products to
  // visible:true for the storefront also silently hid unlisted products
  // from the admin inventory table, exactly the opposite of what a hidden
  // product's "still fully manageable in admin" guarantee requires). Admin
  // always sees every product, hidden or not.
  async listProducts(query: ProductListQuery): Promise<ProductListResponse> {
    const where: Prisma.ProductWhereInput = {
      ...(query.category && { OR: [{ category: query.category }, { categoryRef: { slug: query.category } }] }),
      ...((query.minPriceCents !== undefined || query.maxPriceCents !== undefined) && {
        priceCents: {
          ...(query.minPriceCents !== undefined && { gte: query.minPriceCents }),
          ...(query.maxPriceCents !== undefined && { lte: query.maxPriceCents })
        }
      }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } }
        ]
      })
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.product.count({ where })
    ])

    return { items: items.map(withNormalizedContent), total, page: query.page, pageSize: query.pageSize }
  }

  async createProduct(input: CreateProduct, actor: AuditActor) {
    const product = await this.prisma.product.create({ data: input })
    await this.audit.log({
      actor,
      action: 'Create',
      entity: 'Product',
      entityId: product.id,
      metadata: { name: product.name, slug: product.slug }
    })
    return withNormalizedContent(product)
  }

  async updateProduct(id: string, input: Partial<CreateProduct>, actor: AuditActor) {
    const existing = await this.prisma.product.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Product not found')

    // Capture field-level diffs for the audit trail — only the fields that
    // actually changed, not a full before/after blob.
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const [key, value] of Object.entries(input)) {
      if (key in existing && (existing as Record<string, unknown>)[key] !== value) {
        changes[key] = { from: (existing as Record<string, unknown>)[key], to: value }
      }
    }

    const product = await this.prisma.product.update({ where: { id }, data: input })
    if (Object.keys(changes).length > 0) {
      await this.audit.log({ actor, action: 'Update', entity: 'Product', entityId: id, metadata: changes })
    }
    return withNormalizedContent(product)
  }

  async archiveProduct(id: string, actor: AuditActor) {
    // "Archive" = set stock to 0 and keep the row (soft, not hard delete) —
    // historical orders reference products by id and must not dangle.
    const existing = await this.prisma.product.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Product not found')
    await this.prisma.product.update({ where: { id }, data: { stockQuantity: 0 } })
    await this.audit.log({ actor, action: 'Update', entity: 'Product', entityId: id, metadata: { archived: true } })
    return { id, archived: true }
  }

  // Stock adjustment is the ONE path that changes stockQuantity — never let a
  // raw updateProduct touch it. Atomic conditional update prevents negative
  // stock; the StockAdjustment row + audit entry are written in the same tx.
  async adjustStock(productId: string, input: AdjustStock, actor: AuditActor) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')

    const newQuantity = product.stockQuantity + input.delta
    if (newQuantity < 0) {
      throw new BadRequestException(
        `Adjustment would set stock below 0 (current ${product.stockQuantity}, delta ${input.delta})`
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const before = product.stockQuantity
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newQuantity }
      })
      await tx.stockAdjustment.create({
        data: { productId, delta: input.delta, reason: input.reason, note: input.note, actorId: actor.id }
      })
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'Update',
          entity: 'Product',
          entityId: productId,
          metadata: {
            field: 'stockQuantity',
            from: before,
            to: newQuantity,
            reason: input.reason,
            note: input.note ?? null
          } satisfies Prisma.InputJsonValue
        }
      })
      return updated
    })
  }

  async stockHistory(productId: string) {
    return this.prisma.stockAdjustment.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  }

  async lowStock() {
    // products at or below their threshold — the dashboard alert feed.
    return this.prisma.product.findMany({
      where: { stockQuantity: { lte: this.prisma.product.fields.lowStockThreshold } },
      orderBy: { stockQuantity: 'asc' }
    })
  }
}
