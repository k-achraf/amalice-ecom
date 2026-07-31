import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreateProductAdTest,
  CreateProductSourcingRequest,
  CreateSourcedProduct,
  LinkSourcedProduct,
  ProductAdTestView,
  ProductSourcingRequestView,
  SourcedProductDetail,
  SourcedProductListItem,
  UpdateProductAdTest,
  UpdateProductSourcingRequest,
  UpdateSourcedProduct
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

const detailInclude = {
  linkedProduct: { select: { id: true, name: true, slug: true } },
  adTests: { orderBy: { createdAt: 'desc' as const } },
  sourcingRequests: { include: { wholesaler: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' as const } }
}

function toAdTestView(row: {
  id: string
  sourcedProductId: string
  platform: string
  priceCents: number
  creativeType: string | null
  creativeUrl: string | null
  adSpendCents: number
  ordersCount: number
  revenueCents: number
  status: string
  isWinner: boolean
  startedAt: Date | null
  endedAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): ProductAdTestView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    platform: row.platform as ProductAdTestView['platform'],
    priceCents: row.priceCents,
    creativeType: row.creativeType as ProductAdTestView['creativeType'],
    creativeUrl: row.creativeUrl,
    adSpendCents: row.adSpendCents,
    ordersCount: row.ordersCount,
    revenueCents: row.revenueCents,
    status: row.status as ProductAdTestView['status'],
    isWinner: row.isWinner,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function toRequestView(row: {
  id: string
  sourcedProductId: string
  wholesaler: { id: string; name: string }
  requestedQuantity: number
  requestedCountry: string
  unitCostCents: number | null
  status: string
  notes: string | null
  requestedAt: Date
  receivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ProductSourcingRequestView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    wholesaler: row.wholesaler,
    requestedQuantity: row.requestedQuantity,
    requestedCountry: row.requestedCountry,
    unitCostCents: row.unitCostCents,
    status: row.status as ProductSourcingRequestView['status'],
    notes: row.notes,
    requestedAt: row.requestedAt.toISOString(),
    receivedAt: row.receivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

@Injectable()
export class SourcedProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private toListItem(row: {
    id: string
    name: string
    imageUrl: string | null
    niche: string | null
    status: string
    linkedProduct: { id: string; name: string; slug: string } | null
    _count: { adTests: number; sourcingRequests: number }
    createdAt: Date
    updatedAt: Date
  }): SourcedProductListItem {
    return {
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl,
      niche: row.niche,
      status: row.status as SourcedProductListItem['status'],
      linkedProduct: row.linkedProduct,
      adTestCount: row._count.adTests,
      sourcingRequestCount: row._count.sourcingRequests,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  async list(): Promise<SourcedProductListItem[]> {
    const rows = await this.prisma.sourcedProduct.findMany({
      include: {
        linkedProduct: { select: { id: true, name: true, slug: true } },
        _count: { select: { adTests: true, sourcingRequests: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return rows.map((r) => this.toListItem(r))
  }

  private async findDetailOrThrow(id: string): Promise<SourcedProductDetail> {
    const row = await this.prisma.sourcedProduct.findUnique({ where: { id }, include: detailInclude })
    if (!row) throw new NotFoundException('Sourced product not found')
    return {
      id: row.id,
      name: row.name,
      sourceUrl: row.sourceUrl,
      imageUrl: row.imageUrl,
      niche: row.niche,
      notes: row.notes,
      status: row.status as SourcedProductDetail['status'],
      linkedProduct: row.linkedProduct,
      adTests: row.adTests.map(toAdTestView),
      sourcingRequests: row.sourcingRequests.map(toRequestView),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  get(id: string): Promise<SourcedProductDetail> {
    return this.findDetailOrThrow(id)
  }

  async create(input: CreateSourcedProduct, actor: AuditActor): Promise<SourcedProductDetail> {
    const row = await this.prisma.sourcedProduct.create({ data: input })
    await this.audit.log({ actor, action: 'Create', entity: 'SourcedProduct', entityId: row.id, metadata: input })
    return this.findDetailOrThrow(row.id)
  }

  async update(id: string, input: UpdateSourcedProduct, actor: AuditActor): Promise<SourcedProductDetail> {
    await this.ensureExists(id)
    await this.prisma.sourcedProduct.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProduct', entityId: id, metadata: input })
    return this.findDetailOrThrow(id)
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.ensureExists(id)
    await this.prisma.sourcedProduct.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SourcedProduct', entityId: id })
  }

  // Links (or, with productId: null, unlinks) this candidate to a real
  // catalog Product once it's gone live — SourcedProduct.linkedProductId is
  // @unique, so a Product already linked elsewhere fails fast here rather
  // than as an opaque Prisma constraint error.
  async link(id: string, input: LinkSourcedProduct, actor: AuditActor): Promise<SourcedProductDetail> {
    await this.ensureExists(id)
    if (input.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: input.productId } })
      if (!product) throw new NotFoundException('Product not found')
      const alreadyLinked = await this.prisma.sourcedProduct.findUnique({ where: { linkedProductId: input.productId } })
      if (alreadyLinked && alreadyLinked.id !== id) throw new BadRequestException('That product is already linked to a different sourced product')
    }
    await this.prisma.sourcedProduct.update({ where: { id }, data: { linkedProductId: input.productId } })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProduct', entityId: id, metadata: { linkedProductId: input.productId } })
    return this.findDetailOrThrow(id)
  }

  private async ensureExists(id: string) {
    const row = await this.prisma.sourcedProduct.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Sourced product not found')
    return row
  }

  // ---- Ad tests ----

  async createAdTest(sourcedProductId: string, input: CreateProductAdTest, actor: AuditActor): Promise<ProductAdTestView> {
    await this.ensureExists(sourcedProductId)
    const row = await this.prisma.productAdTest.create({
      data: {
        sourcedProductId,
        ...input,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        endedAt: input.endedAt ? new Date(input.endedAt) : null
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'ProductAdTest', entityId: row.id, metadata: input })
    return toAdTestView(row)
  }

  async updateAdTest(id: string, input: UpdateProductAdTest, actor: AuditActor): Promise<ProductAdTestView> {
    const existing = await this.prisma.productAdTest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Ad test not found')
    const row = await this.prisma.productAdTest.update({
      where: { id },
      data: {
        ...input,
        ...(input.startedAt !== undefined && { startedAt: input.startedAt ? new Date(input.startedAt) : null }),
        ...(input.endedAt !== undefined && { endedAt: input.endedAt ? new Date(input.endedAt) : null })
      }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'ProductAdTest', entityId: id, metadata: input })
    return toAdTestView(row)
  }

  async removeAdTest(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.productAdTest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Ad test not found')
    await this.prisma.productAdTest.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductAdTest', entityId: id })
  }

  // ---- Sourcing requests ----

  async createRequest(sourcedProductId: string, input: CreateProductSourcingRequest, actor: AuditActor): Promise<ProductSourcingRequestView> {
    await this.ensureExists(sourcedProductId)
    const wholesaler = await this.prisma.wholesaler.findUnique({ where: { id: input.wholesalerId } })
    if (!wholesaler) throw new NotFoundException('Wholesaler not found')
    const row = await this.prisma.productSourcingRequest.create({
      data: {
        sourcedProductId,
        wholesalerId: input.wholesalerId,
        requestedQuantity: input.requestedQuantity,
        requestedCountry: input.requestedCountry,
        unitCostCents: input.unitCostCents,
        status: input.status,
        notes: input.notes,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null
      },
      include: { wholesaler: { select: { id: true, name: true } } }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'ProductSourcingRequest', entityId: row.id, metadata: input })
    return toRequestView(row)
  }

  async updateRequest(id: string, input: UpdateProductSourcingRequest, actor: AuditActor): Promise<ProductSourcingRequestView> {
    const existing = await this.prisma.productSourcingRequest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Sourcing request not found')
    if (input.wholesalerId) {
      const wholesaler = await this.prisma.wholesaler.findUnique({ where: { id: input.wholesalerId } })
      if (!wholesaler) throw new NotFoundException('Wholesaler not found')
    }
    const row = await this.prisma.productSourcingRequest.update({
      where: { id },
      data: {
        ...input,
        ...(input.receivedAt !== undefined && { receivedAt: input.receivedAt ? new Date(input.receivedAt) : null })
      },
      include: { wholesaler: { select: { id: true, name: true } } }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'ProductSourcingRequest', entityId: id, metadata: input })
    return toRequestView(row)
  }

  async removeRequest(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.productSourcingRequest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Sourcing request not found')
    await this.prisma.productSourcingRequest.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductSourcingRequest', entityId: id })
  }
}
