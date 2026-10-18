import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Stocktake, SupplierInput } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditActor } from '../common/audit.service'

// Inventory beyond the per-product adjust in AdminCatalogService: variant
// stock, suppliers, low-stock alerts per variant, and physical counts.
@Injectable()
export class AdminInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- suppliers ----
  listSuppliers() {
    return this.prisma.supplier.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  }

  createSupplier(input: SupplierInput) {
    return this.prisma.supplier.create({ data: input })
  }

  async updateSupplier(id: string, input: Partial<SupplierInput>) {
    if (!(await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Supplier not found')
    return this.prisma.supplier.update({ where: { id }, data: input })
  }

  // Restock history for one supplier (what they delivered, when).
  supplierHistory(id: string) {
    return this.prisma.stockAdjustment.findMany({ where: { supplierId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
  }

  // Flat count sheet: every product with its variants and recorded stock.
  async countSheet() {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, stockQuantity: true, variants: { orderBy: { sku: 'asc' }, select: { id: true, sku: true, stockQuantity: true } } }
    })
    return products
  }

  // ---- low stock, variants included ----
  async lowStockVariants() {
    const variants = await this.prisma.productVariant.findMany({
      include: { product: { select: { id: true, name: true, lowStockThreshold: true } } },
      orderBy: { stockQuantity: 'asc' }
    })
    return variants
      .filter((v) => v.stockQuantity <= v.product.lowStockThreshold)
      .map((v) => ({
        variantId: v.id,
        sku: v.sku,
        stockQuantity: v.stockQuantity,
        productId: v.product.id,
        productName: v.product.name,
        lowStockThreshold: v.product.lowStockThreshold
      }))
  }

  // ---- variant stock adjustment ----
  async adjustVariant(
    variantId: string,
    input: { delta: number; reason: string; note?: string; supplierId?: string },
    actor: AuditActor
  ) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!variant) throw new NotFoundException('Variant not found')
    const next = variant.stockQuantity + input.delta
    if (next < 0) {
      throw new BadRequestException(`Adjustment would set stock below 0 (current ${variant.stockQuantity}, delta ${input.delta})`)
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stockQuantity: next } })
      await tx.stockAdjustment.create({
        data: {
          productId: variant.productId,
          variantId,
          delta: input.delta,
          reason: input.reason as never,
          note: input.note,
          actorId: actor.id,
          supplierId: input.supplierId
        }
      })
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'Update',
          entity: 'Product',
          entityId: variant.productId,
          metadata: { field: 'variantStock', variantId, from: variant.stockQuantity, to: next, reason: input.reason }
        }
      })
      return updated
    })
  }

  // ---- stocktake ----
  async applyStocktake(input: Stocktake, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const results: { productId: string; variantId: string | null; before: number; counted: number; delta: number }[] = []
      for (const c of input.counts) {
        const row = c.variantId
          ? await tx.productVariant.findFirst({ where: { id: c.variantId, productId: c.productId }, select: { stockQuantity: true } })
          : await tx.product.findUnique({ where: { id: c.productId }, select: { stockQuantity: true } })
        if (!row) throw new NotFoundException(`Item not found: ${c.variantId ?? c.productId}`)
        const delta = c.counted - row.stockQuantity
        if (delta === 0) continue
        if (c.variantId) await tx.productVariant.update({ where: { id: c.variantId }, data: { stockQuantity: c.counted } })
        else await tx.product.update({ where: { id: c.productId }, data: { stockQuantity: c.counted } })
        await tx.stockAdjustment.create({
          data: { productId: c.productId, variantId: c.variantId, delta, reason: 'Stocktake', note: input.note, actorId: actor.id }
        })
        results.push({ productId: c.productId, variantId: c.variantId ?? null, before: row.stockQuantity, counted: c.counted, delta })
      }
      if (results.length) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'Update',
            entity: 'Product',
            entityId: results[0]!.productId,
            metadata: { stocktake: true, adjusted: results.length }
          }
        })
      }
      return { checked: input.counts.length, adjusted: results.length, results }
    })
  }
}
