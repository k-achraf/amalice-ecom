import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  extractSpreadsheetId,
  ORDER_STATE_LABELS,
  type CreateGoogleSheet,
  type GoogleSheetView,
  type OrderState,
  type TestGoogleSheetResult,
  type UpdateGoogleSheet
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GoogleSheetsClientService, GOOGLE_SHEET_HEADER_ROW } from './google-sheets-client.service'

// Same shape of item include AdminOrdersService uses to build a display-
// ready order (product name, normalized variant label, offer) — duplicated
// here rather than imported since that file's helpers are private to it;
// this is a small enough shape to keep in sync by hand.
const orderInclude = {
  customer: { select: { name: true, phone: true } },
  items: {
    include: {
      product: { select: { name: true } },
      variant: { include: { options: { include: { option: true } } } },
      offer: true
    }
  }
} satisfies Prisma.OrderInclude

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>
type OrderItemWithRelations = OrderWithRelations['items'][number]

function variantLabel(item: OrderItemWithRelations): string | null {
  if (!item.variant) return null
  if (item.variant.options.length) {
    return item.variant.options.map((vo) => vo.option.displayValue ?? vo.option.value).join(' / ')
  }
  const attrs = item.variant.attributes as Record<string, string> | null
  return attrs && Object.keys(attrs).length ? Object.values(attrs).join(' / ') : null
}

function offerLabel(offer: OrderItemWithRelations['offer']): string {
  if (!offer) return '—'
  if (offer.type === 'FixedBundlePrice') return `Bundle (${offer.requiredQuantity} units)`
  if (offer.type === 'BuyXGetYFree') return `Buy ${offer.requiredQuantity} get ${offer.freeQuantity} free`
  if (offer.type === 'FreeShipping') return `Free shipping (buy ${offer.requiredQuantity})`
  return offer.type
}

const dzd = (cents: number) => (cents / 100).toFixed(2)

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly client: GoogleSheetsClientService
  ) {}

  private async isEnabled(): Promise<boolean> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'google-sheets' } })
    return !!row?.enabled
  }

  private sheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  }

  private toView(
    sheet: { id: string; name: string; spreadsheetId: string; sheetName: string; appliesToAllProducts: boolean; enabled: boolean; createdAt: Date; updatedAt: Date },
    products: { id: string; name: string }[]
  ): GoogleSheetView {
    return {
      id: sheet.id,
      name: sheet.name,
      spreadsheetId: sheet.spreadsheetId,
      sheetUrl: this.sheetUrl(sheet.spreadsheetId),
      sheetName: sheet.sheetName,
      appliesToAllProducts: sheet.appliesToAllProducts,
      enabled: sheet.enabled,
      products,
      createdAt: sheet.createdAt.toISOString(),
      updatedAt: sheet.updatedAt.toISOString()
    }
  }

  // ---- Admin CRUD ----

  async list(): Promise<GoogleSheetView[]> {
    const rows = await this.prisma.googleSheet.findMany({
      include: { products: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
    return rows.map((row) => this.toView(row, row.products.map((p) => p.product)))
  }

  async create(input: CreateGoogleSheet, actor: AuditActor): Promise<GoogleSheetView> {
    const spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl)
    const row = await this.prisma.googleSheet.create({
      data: {
        name: input.name,
        spreadsheetId,
        sheetName: input.sheetName,
        appliesToAllProducts: input.appliesToAllProducts,
        enabled: input.enabled,
        products: input.appliesToAllProducts
          ? undefined
          : { create: input.productIds.map((productId) => ({ productId })) }
      },
      include: { products: { include: { product: { select: { id: true, name: true } } } } }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'GoogleSheet', entityId: row.id, metadata: { name: row.name, spreadsheetId } })
    return this.toView(row, row.products.map((p) => p.product))
  }

  async update(id: string, input: UpdateGoogleSheet, actor: AuditActor): Promise<GoogleSheetView> {
    const before = await this.prisma.googleSheet.findUnique({ where: { id } })
    if (!before) throw new NotFoundException('Google Sheet not found')

    const data: Prisma.GoogleSheetUpdateInput = {}
    if (input.name !== undefined) data.name = input.name
    if (input.spreadsheetUrl !== undefined) data.spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl)
    if (input.sheetName !== undefined) data.sheetName = input.sheetName
    if (input.appliesToAllProducts !== undefined) data.appliesToAllProducts = input.appliesToAllProducts
    if (input.enabled !== undefined) data.enabled = input.enabled

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.googleSheet.update({ where: { id }, data })
      // Omitted productIds = leave mapping alone; an explicit array (even
      // empty) replaces it wholesale — same contract UpdateGoogleSheetSchema
      // documents.
      if (input.productIds !== undefined) {
        await tx.productGoogleSheet.deleteMany({ where: { googleSheetId: id } })
        if (input.productIds.length) {
          await tx.productGoogleSheet.createMany({
            data: input.productIds.map((productId) => ({ productId, googleSheetId: id }))
          })
        }
      }
      return tx.googleSheet.findUniqueOrThrow({
        where: { id },
        include: { products: { include: { product: { select: { id: true, name: true } } } } }
      })
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'GoogleSheet',
      entityId: id,
      metadata: { from: { name: before.name, enabled: before.enabled }, to: { name: row.name, enabled: row.enabled } }
    })
    return this.toView(row, row.products.map((p) => p.product))
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    const row = await this.prisma.googleSheet.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Google Sheet not found')
    await this.prisma.googleSheet.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'GoogleSheet', entityId: id, metadata: { name: row.name } })
  }

  async testConnection(id: string): Promise<TestGoogleSheetResult> {
    if (!this.client.isConfigured()) {
      throw new BadRequestException('Set the Google Sheets service account credentials (env) before testing a connection.')
    }
    const row = await this.prisma.googleSheet.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Google Sheet not found')
    const result = await this.client.testConnection(row.spreadsheetId, row.sheetName)
    return { ok: true, message: `Connected to "${result.title}" — header row is ${GOOGLE_SHEET_HEADER_ROW.join(', ')}.` }
  }

  // ---- Order-creation / status-update hooks (called fire-and-forget by
  // OrdersService/AdminOrdersService — see those files for the reasoning:
  // a Sheets outage or misconfiguration must never affect checkout or a
  // status change). ----

  async pushOrderToSheets(orderId: string): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude })
    if (!order) return

    const productIds = [...new Set(order.items.map((i) => i.productId))]
    const targets = await this.prisma.googleSheet.findMany({
      where: {
        enabled: true,
        OR: [{ appliesToAllProducts: true }, { products: { some: { productId: { in: productIds } } } }]
      }
    })
    if (!targets.length) return

    const row = [
      new Date(order.createdAt).toLocaleString(),
      order.id,
      order.customer.name ?? '',
      order.customer.phone,
      order.items.map((i) => i.product.name).join('; '),
      order.items.map((i) => variantLabel(i) ?? '—').join('; '),
      order.items.map((i) => String(i.quantity)).join('; '),
      order.items.map((i) => offerLabel(i.offer)).join('; '),
      order.items.map((i) => dzd(i.lineTotalCents)).join('; '),
      dzd(order.shippingPriceCents),
      dzd(order.totalCents),
      ORDER_STATE_LABELS[order.state]
    ]

    for (const sheet of targets) {
      try {
        await this.client.ensureHeaderRow(sheet.spreadsheetId, sheet.sheetName)
        const rowNumber = await this.client.appendRow(sheet.spreadsheetId, sheet.sheetName, row)
        await this.prisma.googleSheetOrderRow.upsert({
          where: { orderId_googleSheetId: { orderId: order.id, googleSheetId: sheet.id } },
          create: { orderId: order.id, googleSheetId: sheet.id, rowNumber },
          update: { rowNumber }
        })
      } catch (error) {
        // One sheet failing (bad id, not shared with the service account,
        // Google having a bad day) must not block the others or the order.
        this.logger.warn(`Failed to push order ${order.id} to sheet ${sheet.id} (${sheet.name}): ${(error as Error).message}`)
      }
    }
  }

  async updateOrderStatus(orderId: string, state: OrderState): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return

    const rows = await this.prisma.googleSheetOrderRow.findMany({
      where: { orderId },
      include: { googleSheet: true }
    })
    const label = ORDER_STATE_LABELS[state]

    for (const row of rows) {
      if (!row.googleSheet.enabled) continue
      try {
        await this.client.updateStatusCell(row.googleSheet.spreadsheetId, row.googleSheet.sheetName, row.rowNumber, label)
      } catch (error) {
        this.logger.warn(`Failed to update status for order ${orderId} in sheet ${row.googleSheetId}: ${(error as Error).message}`)
      }
    }
  }
}
