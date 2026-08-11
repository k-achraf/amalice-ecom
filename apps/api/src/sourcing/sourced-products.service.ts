import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreateProductAdTest,
  CreateProductSourcingRequest,
  CreateSourcedProduct,
  CreateSourcedProductCompetitor,
  CreateSourcedProductLink,
  CreateSourcedProductMedia,
  CreateSourcedProductVideoCreative,
  LinkSourcedProduct,
  ProductAdTestView,
  ProductSourcingRequestView,
  ReorderSourcedProductMedia,
  SourcedProductCompetitorView,
  SourcedProductDetail,
  SourcedProductLinkView,
  SourcedProductListItem,
  SourcedProductMediaView,
  SourcedProductVideoCreativeView,
  UpdateProductAdTest,
  UpdateProductSourcingRequest,
  UpdateSourcedProduct,
  UpdateSourcedProductCompetitor,
  UpdateSourcedProductLink,
  UpdateSourcedProductMedia,
  UpdateSourcedProductVideoCreative
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

const detailInclude = {
  linkedProduct: { select: { id: true, name: true, slug: true } },
  adTests: { orderBy: { createdAt: 'desc' as const } },
  sourcingRequests: { orderBy: { createdAt: 'desc' as const } },
  media: { orderBy: { sortOrder: 'asc' as const } },
  links: { orderBy: { createdAt: 'asc' as const } },
  videoCreatives: { orderBy: { createdAt: 'asc' as const } },
  competitors: { orderBy: { createdAt: 'asc' as const } }
}

function toMediaView(row: { id: string; sourcedProductId: string; type: string; url: string; caption: string | null; sortOrder: number; createdAt: Date }): SourcedProductMediaView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    type: row.type as SourcedProductMediaView['type'],
    url: row.url,
    caption: row.caption,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString()
  }
}

function toLinkView(row: { id: string; sourcedProductId: string; label: string; url: string; createdAt: Date }): SourcedProductLinkView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    label: row.label,
    url: row.url,
    createdAt: row.createdAt.toISOString()
  }
}

function toVideoCreativeView(row: { id: string; sourcedProductId: string; url: string; platform: string | null; notes: string | null; createdAt: Date }): SourcedProductVideoCreativeView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    url: row.url,
    platform: row.platform as SourcedProductVideoCreativeView['platform'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString()
  }
}

function toCompetitorView(row: { id: string; sourcedProductId: string; name: string | null; url: string; priceCents: number | null; details: string | null; createdAt: Date }): SourcedProductCompetitorView {
  return {
    id: row.id,
    sourcedProductId: row.sourcedProductId,
    name: row.name,
    url: row.url,
    priceCents: row.priceCents,
    details: row.details,
    createdAt: row.createdAt.toISOString()
  }
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
      media: row.media.map(toMediaView),
      links: row.links.map(toLinkView),
      videoCreatives: row.videoCreatives.map(toVideoCreativeView),
      competitors: row.competitors.map(toCompetitorView),
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
    const row = await this.prisma.productSourcingRequest.create({
      data: {
        sourcedProductId,
        requestedQuantity: input.requestedQuantity,
        requestedCountry: input.requestedCountry,
        unitCostCents: input.unitCostCents,
        status: input.status,
        notes: input.notes,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : null
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'ProductSourcingRequest', entityId: row.id, metadata: input })
    return toRequestView(row)
  }

  async updateRequest(id: string, input: UpdateProductSourcingRequest, actor: AuditActor): Promise<ProductSourcingRequestView> {
    const existing = await this.prisma.productSourcingRequest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Sourcing request not found')
    const row = await this.prisma.productSourcingRequest.update({
      where: { id },
      data: {
        ...input,
        ...(input.receivedAt !== undefined && { receivedAt: input.receivedAt ? new Date(input.receivedAt) : null })
      }
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

  // ---- Media (images/videos) ----
  // URLs come from the same generic /admin/upload and /admin/upload-from-url
  // endpoints the real Product Images tab uses (see UploadController) —
  // this service just records them against the sourced product.

  async addMedia(sourcedProductId: string, input: CreateSourcedProductMedia, actor: AuditActor): Promise<SourcedProductMediaView> {
    await this.ensureExists(sourcedProductId)
    const maxSortOrder = await this.prisma.sourcedProductMedia.aggregate({
      where: { sourcedProductId },
      _max: { sortOrder: true }
    })
    const row = await this.prisma.sourcedProductMedia.create({
      data: {
        sourcedProductId,
        type: input.type,
        url: input.url,
        caption: input.caption,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'SourcedProductMedia', entityId: row.id, metadata: input })
    return toMediaView(row)
  }

  async updateMedia(id: string, input: UpdateSourcedProductMedia, actor: AuditActor): Promise<SourcedProductMediaView> {
    const existing = await this.prisma.sourcedProductMedia.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Media item not found')
    const row = await this.prisma.sourcedProductMedia.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProductMedia', entityId: id, metadata: input })
    return toMediaView(row)
  }

  async removeMedia(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.sourcedProductMedia.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Media item not found')
    await this.prisma.sourcedProductMedia.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SourcedProductMedia', entityId: id })
  }

  // Same "send the full ordered id list" pattern as products' reorder-images.
  async reorderMedia(sourcedProductId: string, input: ReorderSourcedProductMedia, actor: AuditActor): Promise<SourcedProductMediaView[]> {
    await this.ensureExists(sourcedProductId)
    await this.prisma.$transaction(
      input.orderedIds.map((id, index) =>
        this.prisma.sourcedProductMedia.updateMany({ where: { id, sourcedProductId }, data: { sortOrder: index } })
      )
    )
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProductMedia', entityId: sourcedProductId, metadata: { reordered: input.orderedIds } })
    const rows = await this.prisma.sourcedProductMedia.findMany({ where: { sourcedProductId }, orderBy: { sortOrder: 'asc' } })
    return rows.map(toMediaView)
  }

  // ---- Links (where this product is listed elsewhere) ----

  async addLink(sourcedProductId: string, input: CreateSourcedProductLink, actor: AuditActor): Promise<SourcedProductLinkView> {
    await this.ensureExists(sourcedProductId)
    const row = await this.prisma.sourcedProductLink.create({ data: { sourcedProductId, label: input.label, url: input.url } })
    await this.audit.log({ actor, action: 'Create', entity: 'SourcedProductLink', entityId: row.id, metadata: input })
    return toLinkView(row)
  }

  async updateLink(id: string, input: UpdateSourcedProductLink, actor: AuditActor): Promise<SourcedProductLinkView> {
    const existing = await this.prisma.sourcedProductLink.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Link not found')
    const row = await this.prisma.sourcedProductLink.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProductLink', entityId: id, metadata: input })
    return toLinkView(row)
  }

  async removeLink(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.sourcedProductLink.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Link not found')
    await this.prisma.sourcedProductLink.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SourcedProductLink', entityId: id })
  }

  // ---- Video creatives ----

  async addVideoCreative(sourcedProductId: string, input: CreateSourcedProductVideoCreative, actor: AuditActor): Promise<SourcedProductVideoCreativeView> {
    await this.ensureExists(sourcedProductId)
    const row = await this.prisma.sourcedProductVideoCreative.create({
      data: { sourcedProductId, url: input.url, platform: input.platform ?? null, notes: input.notes }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'SourcedProductVideoCreative', entityId: row.id, metadata: input })
    return toVideoCreativeView(row)
  }

  async updateVideoCreative(id: string, input: UpdateSourcedProductVideoCreative, actor: AuditActor): Promise<SourcedProductVideoCreativeView> {
    const existing = await this.prisma.sourcedProductVideoCreative.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Video creative not found')
    const row = await this.prisma.sourcedProductVideoCreative.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProductVideoCreative', entityId: id, metadata: input })
    return toVideoCreativeView(row)
  }

  async removeVideoCreative(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.sourcedProductVideoCreative.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Video creative not found')
    await this.prisma.sourcedProductVideoCreative.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SourcedProductVideoCreative', entityId: id })
  }

  // ---- Competitors ----

  async addCompetitor(sourcedProductId: string, input: CreateSourcedProductCompetitor, actor: AuditActor): Promise<SourcedProductCompetitorView> {
    await this.ensureExists(sourcedProductId)
    const row = await this.prisma.sourcedProductCompetitor.create({
      data: { sourcedProductId, name: input.name, url: input.url, priceCents: input.priceCents, details: input.details }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'SourcedProductCompetitor', entityId: row.id, metadata: input })
    return toCompetitorView(row)
  }

  async updateCompetitor(id: string, input: UpdateSourcedProductCompetitor, actor: AuditActor): Promise<SourcedProductCompetitorView> {
    const existing = await this.prisma.sourcedProductCompetitor.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Competitor not found')
    const row = await this.prisma.sourcedProductCompetitor.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'SourcedProductCompetitor', entityId: id, metadata: input })
    return toCompetitorView(row)
  }

  async removeCompetitor(id: string, actor: AuditActor): Promise<void> {
    const existing = await this.prisma.sourcedProductCompetitor.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Competitor not found')
    await this.prisma.sourcedProductCompetitor.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SourcedProductCompetitor', entityId: id })
  }
}
