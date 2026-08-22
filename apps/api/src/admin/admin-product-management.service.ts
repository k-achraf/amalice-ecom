import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  GeneratedProductContentSchema,
  type AdminProductDetail,
  type CreateProductImage,
  type CreateProductVariant,
  type UpdateProductImage,
  type UpdateProductVariant,
  type CreateAttribute,
  type CreateAttributeOption,
  type CreateProductOffer,
  type UpdateProductOffer,
  type CreateProductUpsell,
  type UpdateProductUpsell,
  type ProductFaq,
  type ProductSpecification,
  type GenerateProductContent,
  type GeneratedProductContent
} from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GeminiService } from '../landing-pages/gemini.service'
import { fetchImageAsInline } from '../landing-pages/landing-page-storage.util'

// Full product management — variant/image/attribute CRUD for the admin editor.
// Split from AdminCatalogService (which owns the flat product fields + stock)
// so each concern stays readable. All write ops are audit-logged (SEC-03).
@Injectable()
export class AdminProductManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService
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
        },
        offers: { orderBy: { createdAt: 'asc' } }
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
      visible: product.visible,
      priceCents: product.priceCents,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      requireOfferSelection: product.requireOfferSelection,
      keyBenefits: product.keyBenefits,
      faqs: (product.faqs as ProductFaq[] | null) ?? [],
      specifications: (product.specifications as ProductSpecification[] | null) ?? [],
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
      })),
      offers: product.offers.map((o) => ({
        id: o.id,
        productId: o.productId,
        type: o.type,
        enabled: o.enabled,
        requiredQuantity: o.requiredQuantity,
        freeQuantity: o.freeQuantity,
        bundlePriceCents: o.bundlePriceCents,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString()
      }))
    }
  }

  // "Generate with AI" — the admin pastes a raw, messy content dump (title/
  // description/specs/FAQ all mixed together, any language) and optionally
  // picks a few of the product's own photos; Gemini's free text model
  // (GeminiService.draftProductContent) turns that into a polished,
  // conversion-focused draft. This never writes to the product — the admin
  // reviews the draft in the UI and saves it (or edits first) through the
  // normal PATCH endpoint (updateProduct/saveContent), same as anything
  // else typed into those tabs.
  async generateContent(productId: string, input: GenerateProductContent, actor: AuditActor): Promise<GeneratedProductContent> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { images: true } })
    if (!product) throw new NotFoundException('Product not found')

    const validUrls = new Set(product.images.map((i) => i.url))
    const invalid = input.sourceImageUrls.filter((u) => !validUrls.has(u))
    if (invalid.length > 0) {
      throw new BadRequestException(`These images don't belong to this product: ${invalid.join(', ')}`)
    }

    const sourceImages = await Promise.all(input.sourceImageUrls.map((url) => fetchImageAsInline(url)))
    const draft = await this.gemini.draftProductContent({
      rawContent: input.rawContent,
      sourceImages,
      instructions: input.instructions
    })

    const parsed = GeneratedProductContentSchema.safeParse(draft)
    if (!parsed.success) {
      throw new BadGatewayException('The AI returned content in an unexpected format — try again.')
    }

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Product',
      entityId: productId,
      metadata: { action: 'generate-content', sourceImageCount: input.sourceImageUrls.length }
    })

    return parsed.data
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

  // ---- Offer CRUD ----
  // Cross-field checks (bundlePriceCents required for FixedBundlePrice,
  // freeQuantity>=1 for BuyXGetYFree) live here rather than in the Zod
  // schema — easier to express than threading them through
  // CreateProductOfferSchema/UpdateProductOfferSchema's .partial() split.
  private validateOfferShape(type: string, bundlePriceCents: number | null | undefined, freeQuantity: number | undefined) {
    if (type === 'FixedBundlePrice' && (bundlePriceCents === null || bundlePriceCents === undefined)) {
      throw new BadRequestException('Bundle price is required for a fixed-bundle-price offer')
    }
    if (type === 'BuyXGetYFree' && (freeQuantity === undefined || freeQuantity < 1)) {
      throw new BadRequestException('Free quantity must be at least 1 for a buy-X-get-Y-free offer')
    }
  }

  async createOffer(productId: string, input: CreateProductOffer, actor: AuditActor) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')
    this.validateOfferShape(input.type, input.bundlePriceCents, input.freeQuantity)

    const offer = await this.prisma.productOffer.create({
      data: {
        productId,
        type: input.type,
        requiredQuantity: input.requiredQuantity,
        freeQuantity: input.freeQuantity ?? 0,
        bundlePriceCents: input.type === 'FixedBundlePrice' ? (input.bundlePriceCents ?? null) : null
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'ProductOffer', entityId: offer.id, metadata: { productId, type: offer.type } })
    return offer
  }

  async updateOffer(productId: string, offerId: string, input: UpdateProductOffer, actor: AuditActor) {
    const offer = await this.prisma.productOffer.findUnique({ where: { id: offerId } })
    if (!offer || offer.productId !== productId) throw new NotFoundException('Offer not found')

    const nextType = input.type ?? offer.type
    const nextBundlePriceCents = input.bundlePriceCents !== undefined ? input.bundlePriceCents : offer.bundlePriceCents
    const nextFreeQuantity = input.freeQuantity !== undefined ? input.freeQuantity : offer.freeQuantity
    this.validateOfferShape(nextType, nextBundlePriceCents, nextFreeQuantity)

    const updated = await this.prisma.productOffer.update({
      where: { id: offerId },
      data: {
        type: input.type,
        requiredQuantity: input.requiredQuantity,
        freeQuantity: input.freeQuantity,
        bundlePriceCents: nextType === 'FixedBundlePrice' ? nextBundlePriceCents : null,
        enabled: input.enabled
      }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'ProductOffer', entityId: offerId, metadata: { productId, changes: input } })
    return updated
  }

  async deleteOffer(productId: string, offerId: string, actor: AuditActor) {
    const offer = await this.prisma.productOffer.findUnique({ where: { id: offerId } })
    if (!offer || offer.productId !== productId) throw new NotFoundException('Offer not found')
    await this.prisma.productOffer.delete({ where: { id: offerId } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductOffer', entityId: offerId, metadata: { productId } })
    return { id: offerId, deleted: true }
  }

  // ---- Upsells system: ProductUpsell CRUD ----
  // Same shape as Offer CRUD above — per-product, admin-configured pairings
  // (see ProductUpsell's Prisma comment). upsellProduct is always joined in
  // so the admin editor and the public order-upsell lookup never need a
  // second product fetch.
  private readonly upsellInclude = {
    upsellProduct: { select: { id: true, name: true, slug: true, imageUrl: true, priceCents: true } }
  } satisfies Prisma.ProductUpsellInclude

  async listUpsells(productId: string) {
    return this.prisma.productUpsell.findMany({
      where: { productId },
      include: this.upsellInclude,
      orderBy: { createdAt: 'asc' }
    })
  }

  async createUpsell(productId: string, input: CreateProductUpsell, actor: AuditActor) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')
    if (input.upsellProductId === productId) throw new BadRequestException("A product can't be its own upsell")
    const upsellProduct = await this.prisma.product.findUnique({ where: { id: input.upsellProductId } })
    if (!upsellProduct) throw new NotFoundException('Upsell product not found')

    let created
    try {
      created = await this.prisma.productUpsell.create({
        data: { productId, upsellProductId: input.upsellProductId, priceCentsOverride: input.priceCentsOverride ?? null },
        include: this.upsellInclude
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('This upsell is already configured for this product')
      }
      throw err
    }
    await this.audit.log({ actor, action: 'Create', entity: 'ProductUpsell', entityId: created.id, metadata: { productId, upsellProductId: input.upsellProductId } })
    return created
  }

  async updateUpsell(productId: string, upsellId: string, input: UpdateProductUpsell, actor: AuditActor) {
    const upsell = await this.prisma.productUpsell.findUnique({ where: { id: upsellId } })
    if (!upsell || upsell.productId !== productId) throw new NotFoundException('Upsell not found')

    const updated = await this.prisma.productUpsell.update({
      where: { id: upsellId },
      data: { enabled: input.enabled, priceCentsOverride: input.priceCentsOverride },
      include: this.upsellInclude
    })
    await this.audit.log({ actor, action: 'Update', entity: 'ProductUpsell', entityId: upsellId, metadata: { productId, changes: input } })
    return updated
  }

  async deleteUpsell(productId: string, upsellId: string, actor: AuditActor) {
    const upsell = await this.prisma.productUpsell.findUnique({ where: { id: upsellId } })
    if (!upsell || upsell.productId !== productId) throw new NotFoundException('Upsell not found')
    await this.prisma.productUpsell.delete({ where: { id: upsellId } })
    await this.audit.log({ actor, action: 'Delete', entity: 'ProductUpsell', entityId: upsellId, metadata: { productId } })
    return { id: upsellId, deleted: true }
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
