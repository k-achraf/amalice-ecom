import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  AdminProductDetail,
  CreateProductImage,
  CreateProductVariant,
  UpdateProductImage,
  UpdateProductVariant,
  CreateAttribute,
  CreateAttributeOption
} from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// Full product management — variant/image/attribute CRUD for the admin editor.
// Split from AdminCatalogService (which owns the flat product fields + stock)
// so each concern stays readable. All write ops are audit-logged (SEC-03).
@Injectable()
export class AdminProductManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // ---- Full product detail for the editor ----
  async getProductForAdmin(productId: string): Promise<AdminProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          include: {
            options: {
              include: {
                option: {
                  include: { attribute: { select: { name: true } } }
                }
              }
            }
          }
        },
        productAttributes: {
          include: {
            attribute: {
              include: { options: { orderBy: { sortOrder: 'asc' } } }
            }
          },
          orderBy: { attribute: { sortOrder: 'asc' } }
        }
      }
    })
    if (!product) throw new NotFoundException('Product not found')

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
      featured: product.featured,
      bestSeller: product.bestSeller,
      priceCents: product.priceCents,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      images: product.images.map((i) => ({ id: i.id, url: i.url, altText: i.altText, sortOrder: i.sortOrder })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity,
        options: v.options.map((vo) => ({
          id: vo.option.id,
          value: vo.option.value,
          attributeName: vo.option.attribute.name,
          colorHex: vo.option.colorHex
        }))
      })),
      attributes: product.productAttributes.map((pa) => ({
        id: pa.attribute.id,
        name: pa.attribute.name,
        type: pa.attribute.type,
        sortOrder: pa.attribute.sortOrder,
        options: pa.attribute.options.map((o) => ({ id: o.id, value: o.value, displayValue: o.displayValue, colorHex: o.colorHex }))
      }))
    }
  }

  // ---- Variant CRUD ----
  async createVariant(productId: string, input: CreateProductVariant, actor: AuditActor) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')

    // Verify the product has the attributes these options belong to.
    const options = await this.prisma.attributeOption.findMany({
      where: { id: { in: input.optionIds } },
      include: { attribute: true }
    })
    if (options.length !== input.optionIds.length) {
      throw new BadRequestException('One or more options not found')
    }
    const productAttrs = await this.prisma.productAttribute.findMany({ where: { productId } })
    const productAttrIds = new Set(productAttrs.map((pa) => pa.attributeId))
    for (const opt of options) {
      if (!productAttrIds.has(opt.attributeId)) {
        throw new BadRequestException(`Product does not use attribute "${opt.attribute.name}"`)
      }
    }

    // Build the legacy attributes map from the resolved options (back-compat).
    const attributesMap: Record<string, string> = {}
    for (const opt of options) {
      attributesMap[opt.attribute.name.toLowerCase()] = opt.value
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: input.sku,
        attributes: attributesMap,
        priceCents: input.priceCents,
        stockQuantity: input.stockQuantity,
        options: {
          create: input.optionIds.map((optionId) => ({ optionId }))
        }
      },
      include: { options: { include: { option: { include: { attribute: true } } } } }
    })

    await this.audit.log({
      actor,
      action: 'Create',
      entity: 'ProductVariant',
      entityId: variant.id,
      metadata: { productId, sku: variant.sku, optionIds: input.optionIds }
    })

    return variant
  }

  async updateVariant(productId: string, variantId: string, input: UpdateProductVariant, actor: AuditActor) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found')

    const data: Prisma.ProductVariantUncheckedUpdateInput = {}
    if (input.sku !== undefined) data.sku = input.sku
    if (input.priceCents !== undefined) data.priceCents = input.priceCents
    if (input.stockQuantity !== undefined) data.stockQuantity = input.stockQuantity

    // If optionIds provided, replace the variant's options.
    if (input.optionIds !== undefined) {
      const options = await this.prisma.attributeOption.findMany({
        where: { id: { in: input.optionIds } },
        include: { attribute: true }
      })
      const attributesMap: Record<string, string> = {}
      for (const opt of options) {
        attributesMap[opt.attribute.name.toLowerCase()] = opt.value
      }
      data.attributes = attributesMap

      await this.prisma.variantOption.deleteMany({ where: { variantId } })
      data.options = {
        create: input.optionIds.map((optionId) => ({ optionId }))
      }
    }

    const updated = await this.prisma.productVariant.update({ where: { id: variantId }, data })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductVariant',
      entityId: variantId,
      metadata: { productId, changes: input }
    })

    return updated
  }

  async deleteVariant(productId: string, variantId: string, actor: AuditActor) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!variant || variant.productId !== productId) throw new NotFoundException('Variant not found')

    await this.prisma.productVariant.delete({ where: { id: variantId } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductVariant', entityId: variantId, metadata: { productId } })
    return { id: variantId, deleted: true }
  }

  // ---- Image CRUD ----
  async addImage(productId: string, input: CreateProductImage, actor: AuditActor) {
    const image = await this.prisma.productImage.create({ data: { productId, ...input } })
    // If this is the first image, set it as the hero (denormalized imageUrl).
    const count = await this.prisma.productImage.count({ where: { productId } })
    if (count === 1) {
      await this.prisma.product.update({ where: { id: productId }, data: { imageUrl: input.url } })
    }
    await this.audit.log({ actor, action: 'Create', entity: 'ProductImage', entityId: image.id, metadata: { productId, url: input.url } })
    return image
  }

  async updateImage(productId: string, imageId: string, input: UpdateProductImage, actor: AuditActor) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } })
    if (!image || image.productId !== productId) throw new NotFoundException('Image not found')
    const updated = await this.prisma.productImage.update({ where: { id: imageId }, data: input })
    // If the hero image's URL changed, update the denormalized field.
    if (image.sortOrder === 0 && input.url) {
      await this.prisma.product.update({ where: { id: productId }, data: { imageUrl: input.url } })
    }
    await this.audit.log({ actor, action: 'Update', entity: 'ProductImage', entityId: imageId, metadata: input })
    return updated
  }

  async deleteImage(productId: string, imageId: string, actor: AuditActor) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } })
    if (!image || image.productId !== productId) throw new NotFoundException('Image not found')
    await this.prisma.productImage.delete({ where: { id: imageId } })
    // If we deleted the hero, promote the next image (lowest sortOrder).
    const next = await this.prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } })
    await this.prisma.product.update({ where: { id: productId }, data: { imageUrl: next?.url ?? null } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductImage', entityId: imageId, metadata: { productId } })
    return { id: imageId, deleted: true }
  }

  async reorderImages(productId: string, orderedIds: string[], actor: AuditActor) {
    await this.prisma.$transaction(
      orderedIds.map((imageId, index) =>
        this.prisma.productImage.update({ where: { id: imageId }, data: { sortOrder: index } })
      )
    )
    // Update hero to the new first image.
    const first = await this.prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } })
    if (first) {
      await this.prisma.product.update({ where: { id: productId }, data: { imageUrl: first.url } })
    }
    await this.audit.log({ actor, action: 'Update', entity: 'ProductImage', entityId: productId, metadata: { action: 'reorder', orderedIds } })
    return { reordered: true }
  }

  // ---- Product-Attribute management ----
  async applyAttribute(productId: string, attributeId: string, actor: AuditActor) {
    await this.prisma.productAttribute.upsert({
      where: { productId_attributeId: { productId, attributeId } },
      update: {},
      create: { productId, attributeId }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'Product', entityId: productId, metadata: { action: 'applyAttribute', attributeId } })
    return { applied: true }
  }

  async removeAttribute(productId: string, attributeId: string, actor: AuditActor) {
    // Also remove any variant options referencing this attribute's options.
    const optionIds = (await this.prisma.attributeOption.findMany({ where: { attributeId }, select: { id: true } })).map((o) => o.id)
    if (optionIds.length > 0) {
      const variantIds = (await this.prisma.productVariant.findMany({ where: { productId }, select: { id: true } })).map((v) => v.id)
      if (variantIds.length > 0) {
        await this.prisma.variantOption.deleteMany({ where: { variantId: { in: variantIds }, optionId: { in: optionIds } } })
      }
    }
    await this.prisma.productAttribute.deleteMany({ where: { productId, attributeId } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductAttribute', entityId: `${productId}/${attributeId}`, metadata: { productId, attributeId } })
    return { removed: true }
  }

  // ---- Store-wide Attribute management ----
  async listAttributes() {
    return this.prisma.attribute.findMany({
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    })
  }

  async createAttribute(input: CreateAttribute, actor: AuditActor) {
    const attr = await this.prisma.attribute.create({ data: { name: input.name, type: input.type } })
    await this.audit.log({ actor, action: 'Create', entity: 'Attribute', entityId: attr.id, metadata: { name: attr.name, type: attr.type } })
    return attr
  }

  async addOption(attributeId: string, input: CreateAttributeOption, actor: AuditActor) {
    const count = await this.prisma.attributeOption.count({ where: { attributeId } })
    const opt = await this.prisma.attributeOption.create({
      data: {
        attributeId,
        value: input.value,
        displayValue: input.displayValue,
        colorHex: input.colorHex,
        sortOrder: count
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'AttributeOption', entityId: opt.id, metadata: { attributeId, value: opt.value } })
    return opt
  }

  async deleteAttribute(id: string, actor: AuditActor) {
    await this.prisma.attribute.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'Attribute', entityId: id, metadata: {} })
    return { id, deleted: true }
  }
}
