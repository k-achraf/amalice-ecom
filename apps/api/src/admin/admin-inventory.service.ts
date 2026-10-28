import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  STOCK_BUCKETS,
  STOCK_BUCKET_STATES,
  stockUnits,
  type OrderState,
  type StockBucketKey,
  type StockDetails,
  type StockDetailsRow,
  type StockMovementsResponse,
  type Stocktake,
  type SupplierInput
} from '@amalice/shared'
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

  // ---- one product's stock, in detail ----

  private variantLabel(v: { sku: string; options: { option: { value: string; displayValue: string | null } }[] }): string {
    const parts = v.options.map((o) => o.option.displayValue ?? o.option.value)
    return parts.length ? parts.join(' / ') : v.sku
  }

  // Where the units of one product are: recorded stock, and the units of every order that contains
  // it grouped by what became of the order (see STOCK_BUCKET_STATES). Cancelled orders and abandoned
  // carts are not demand; archived orders still count as delivered/with the courier but an archived
  // order that was never confirmed is not waiting for anything, so it is left out of "unconfirmed".
  async stockDetails(productId: string): Promise<StockDetails> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        stockQuantity: true,
        lowStockThreshold: true,
        variants: { orderBy: { sku: 'asc' }, select: { id: true, sku: true, stockQuantity: true, options: { select: { option: { select: { value: true, displayValue: true } } } } } }
      }
    })
    if (!product) throw new NotFoundException('Product not found')

    const items = await this.prisma.orderItem.findMany({
      where: { productId },
      select: { variantId: true, quantity: true, order: { select: { id: true, state: true, isAbandoned: true, archived: true, stockReservedAt: true } } }
    })

    const bucketOf = new Map<OrderState, StockBucketKey>()
    for (const key of STOCK_BUCKETS) for (const state of STOCK_BUCKET_STATES[key]) bucketOf.set(state, key)

    const hasVariants = product.variants.length > 0
    const rowKey = (variantId: string | null) => (hasVariants && variantId ? variantId : 'base')
    type Acc = { orders: Set<string>; units: number }
    const empty = () => Object.fromEntries(STOCK_BUCKETS.map((b) => [b, { orders: new Set<string>(), units: 0 }])) as Record<StockBucketKey, Acc>
    const perRow = new Map<string, { buckets: Record<StockBucketKey, Acc>; reserved: number; hasItems: boolean }>()
    const total = empty()
    const byState = new Map<string, { bucket: StockBucketKey; state: OrderState; orders: Set<string>; units: number }>()
    const abandonedOrders = new Set<string>()
    let abandonedUnits = 0

    for (const item of items) {
      const units = stockUnits(item.quantity)
      const o = item.order
      if (o.isAbandoned) {
        abandonedOrders.add(o.id)
        abandonedUnits += units
        continue
      }
      const bucket = bucketOf.get(o.state as OrderState)
      if (!bucket) continue // cancelled
      if (bucket === 'unconfirmed' && o.archived) continue
      const key = rowKey(item.variantId)
      const row = perRow.get(key) ?? { buckets: empty(), reserved: 0, hasItems: true }
      perRow.set(key, row)
      row.buckets[bucket].orders.add(o.id)
      row.buckets[bucket].units += units
      total[bucket].orders.add(o.id)
      total[bucket].units += units
      if (o.stockReservedAt && (bucket === 'unconfirmed' || bucket === 'confirmed')) row.reserved += units
      const sk = `${bucket}|${o.state}`
      const s = byState.get(sk) ?? { bucket, state: o.state as OrderState, orders: new Set<string>(), units: 0 }
      s.orders.add(o.id)
      s.units += units
      byState.set(sk, s)
    }

    const toBuckets = (acc: Record<StockBucketKey, Acc>) => Object.fromEntries(STOCK_BUCKETS.map((b) => [b, { orders: acc[b].orders.size, units: acc[b].units }])) as StockDetailsRow['buckets']
    const build = (variantId: string | null, label: string, sku: string | null, onHand: number, key: string): StockDetailsRow => {
      const r = perRow.get(key)
      const reservedUnits = r?.reserved ?? 0
      return {
        variantId,
        label,
        sku,
        onHand,
        lowStockThreshold: product.lowStockThreshold,
        buckets: toBuckets(r?.buckets ?? empty()),
        reservedUnits,
        physicalInWarehouse: onHand + reservedUnits
      }
    }
    const rows: StockDetailsRow[] = hasVariants
      ? product.variants.map((v) => build(v.id, this.variantLabel(v), v.sku, v.stockQuantity, v.id))
      : [build(null, product.name, null, product.stockQuantity, 'base')]
    // Order lines that name no variant on a product that has variants (older orders).
    if (hasVariants && perRow.has('base')) rows.push(build(null, 'No variant (base product)', null, product.stockQuantity, 'base'))

    const onHand = rows.reduce((a, r) => a + r.onHand, 0)
    const reservedUnits = rows.reduce((a, r) => a + r.reservedUnits, 0)
    const buckets = Object.fromEntries(
      STOCK_BUCKETS.map((b) => [
        b,
        {
          orders: total[b].orders.size,
          units: total[b].units,
          byState: [...byState.values()].filter((s) => s.bucket === b).map((s) => ({ state: s.state, orders: s.orders.size, units: s.units }))
        }
      ])
    ) as StockDetails['buckets']

    return {
      product: { id: product.id, name: product.name, imageUrl: product.imageUrl, sku: null, lowStockThreshold: product.lowStockThreshold, hasVariants },
      onHand,
      reservedUnits,
      physicalInWarehouse: onHand + reservedUnits,
      buckets,
      abandoned: { orders: abandonedOrders.size, units: abandonedUnits },
      rows,
      generatedAt: new Date().toISOString()
    }
  }

  // The stock ledger of one product (every movement, newest first).
  async stockMovements(productId: string, q: { page: number; pageSize: number; variantId?: string; reason?: string }): Promise<StockMovementsResponse> {
    const validReasons = ['Restock', 'Correction', 'Damage', 'Sale', 'Return', 'Release', 'Stocktake'] as const
    const reason = validReasons.find((r) => r === q.reason)
    const where = { productId, ...(q.variantId && { variantId: q.variantId }), ...(reason && { reason }) }
    const [rows, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { supplier: { select: { name: true } } }
      }),
      this.prisma.stockAdjustment.count({ where })
    ])
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))]
    const actors = actorIds.length ? await this.prisma.adminUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } }) : []
    const emailById = new Map(actors.map((a) => [a.id, a.email]))
    const variantIds = [...new Set(rows.map((r) => r.variantId).filter((x): x is string => !!x))]
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, options: { select: { option: { select: { value: true, displayValue: true } } } } } })
      : []
    const labelById = new Map(variants.map((v) => [v.id, this.variantLabel(v)]))
    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        delta: r.delta,
        reason: r.reason,
        note: r.note,
        variantId: r.variantId,
        variantLabel: r.variantId ? (labelById.get(r.variantId) ?? null) : null,
        orderId: r.orderId,
        actorEmail: r.actorId ? (emailById.get(r.actorId) ?? null) : null,
        supplierName: r.supplier?.name ?? null
      })),
      total,
      page: q.page,
      pageSize: q.pageSize
    }
  }
}
