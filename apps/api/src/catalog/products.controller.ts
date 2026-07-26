import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ProductListQuerySchema, type ProductListResponse } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import { PrismaService } from '../prisma/prisma.service'
import { CatalogSearchService } from './catalog-search.service'
import type { Prisma } from '../generated/prisma/client'

class ProductListQueryDto extends createZodDto(ProductListQuerySchema) {}

@ApiTags('catalog')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: CatalogSearchService
  ) {}

  @Get()
  async list(@Query() query: ProductListQueryDto): Promise<ProductListResponse> {
    const searchFilter = await this.search.buildSearchFilter(query.q)

    const where: Prisma.ProductWhereInput = {
      ...(query.category && {
        // Match either the flat `category` tag (back-compat) or the
        // normalized Category.slug via the relation. The `?category=bags`
        // filter must work for both legacy and SF-17-normalized products.
        OR: [{ category: query.category }, { categoryRef: { slug: query.category } }]
      }),
      ...((query.minPriceCents !== undefined || query.maxPriceCents !== undefined) && {
        priceCents: {
          ...(query.minPriceCents !== undefined && { gte: query.minPriceCents }),
          ...(query.maxPriceCents !== undefined && { lte: query.maxPriceCents })
        }
      }),
      ...searchFilter
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

    return { items, total, page: query.page, pageSize: query.pageSize }
  }

  // SF-15 — rich PDP. Includes the image gallery, variants, category, and
  // related products (same category, excluding self). Approved reviews and
  // the aggregate rating summary come from the reviews controller (SF-16),
  // not this endpoint — kept separate so a PDP can load reviews lazily.
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
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
        categoryRef: true
      }
    })
    if (!product) throw new NotFoundException('Product not found')

    // Resolve each variant's normalized options into the legacy {key: value}
    // attributes map — so the storefront PDP's variantOptions computed works
    // without changes. New variants (via VariantOption) produce the same shape
    // as the old free-form JSON blob.
    const variantsWithResolvedAttrs = product.variants.map((v) => {
      const resolved: Record<string, string> = {}
      for (const vo of v.options) {
        resolved[vo.option.attribute.name.toLowerCase()] = vo.option.value
      }
      // Merge: prefer resolved options; fall back to the legacy JSON blob for
      // variants created before the normalized system (back-compat).
      const legacyAttrs = (v.attributes as Record<string, string> | null) ?? {}
      return { ...v, attributes: { ...legacyAttrs, ...resolved } }
    })

    // Related: same category (tag or FK), excluding self, capped at 4. Falls
    // back to "nothing" cleanly if the product is the only one in its category.
    const related = await this.prisma.product.findMany({
      where: {
        AND: [{ id: { not: product.id } }, { OR: [{ category: product.category }, ...(product.categoryId ? [{ categoryId: product.categoryId }] : [])] }]
      },
      take: 4,
      orderBy: { createdAt: 'desc' }
    })

    return { ...product, variants: variantsWithResolvedAttrs, related }
  }
}
