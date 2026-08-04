import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import {
  extractSpreadsheetId,
  isValidTransition,
  ORDER_STAGE_BY_STATE,
  ORDER_STATE_LABELS,
  ORDER_STATE_SHEET_COLORS,
  type CreateGoogleSheet,
  type GoogleSheetView,
  type OrderState,
  type TestGoogleSheetResult,
  type UpdateGoogleSheet
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GoogleSheetsClientService, GOOGLE_SHEET_COLUMNS, GOOGLE_SHEET_HEADER_ROW, COLUMN_INDEX, type GoogleSheetStatusColumn } from './google-sheets-client.service'

// Reverse of ORDER_STATE_LABELS — resolves a sheet cell's label text back to
// the OrderState it represents, for the poll job (a human typed/picked a
// label, we need the enum key to validate+apply the transition).
const LABEL_TO_STATE: Record<string, OrderState> = Object.fromEntries(
  Object.entries(ORDER_STATE_LABELS).map(([state, label]) => [label, state as OrderState])
)

// Attributed to sheet-triggered changes in the audit log, so "who changed
// this" is honest — not a real admin, but not silently blank either.
const SHEETS_SYNC_ACTOR: AuditActor = { id: 'system:google-sheets', email: 'google-sheets-sync' }

// Same shape of item include AdminOrdersService uses to build a display-
// ready order (product name, normalized variant label, offer) — duplicated
// here rather than imported since that file's helpers are private to it;
// this is a small enough shape to keep in sync by hand.
const orderInclude = {
  customer: { select: { name: true, phone: true } },
  shippingCompany: { select: { name: true } },
  shipment: { select: { id: true } },
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

// "Sent to Shipping Company" — Yes only once an actual shipping company has
// a shipment recorded against it (real DHD dispatch, or a manual record of a
// shipment arranged directly with that company — see FulfillmentService.
// dispatchManual). Manual (in-house driver) deliveries never involve a
// shipping company at all, so they're always No here even once dispatched.
function shippingSentLabel(order: Pick<OrderWithRelations, 'fulfillmentMethod' | 'shipment'>): string {
  return order.fulfillmentMethod === 'ShippingCompany' && order.shipment ? 'Yes' : 'No'
}

function shippingCompanyLabel(order: Pick<OrderWithRelations, 'fulfillmentMethod' | 'shippingCompany'>): string {
  if (order.fulfillmentMethod === 'ShippingCompany') return order.shippingCompany?.name ?? '—'
  if (order.fulfillmentMethod === 'Manual') return 'Delivery man'
  return '—'
}

// Which of the 3 status columns a transition's new state belongs in. States
// in the CallCenter/Fulfillment/Shipping stages map onto their own column
// directly; Finance (post-delivery reconciliation) and Other (Cancelled/
// Restocked) states don't get a column of their own (the sheet only asked
// for 3), so they're attributed to whichever operational column the order
// was just in — Finance always follows Delivered (Shipping), and every real
// Cancelled/Restocked transition has a `from` in one of the three stages
// (see VALID_TRANSITIONS) with 'Shipping' as the last-resort fallback.
function resolveStatusColumn(from: OrderState, to: OrderState): GoogleSheetStatusColumn {
  const stage = ORDER_STAGE_BY_STATE[to]
  if (stage === 'CallCenter') return 'callCenterStatus'
  if (stage === 'Fulfillment') return 'fulfillmentStatus'
  if (stage === 'Shipping') return 'deliveryStatus'
  const fromStage = ORDER_STAGE_BY_STATE[from]
  if (fromStage === 'CallCenter') return 'callCenterStatus'
  if (fromStage === 'Fulfillment') return 'fulfillmentStatus'
  return 'deliveryStatus'
}

// How often the poll job checks connected sheets for manual edits (item 2 of
// the "select in the sheet, sync back" request). There's no Apps Script
// bound to the spreadsheet and no OAuth user session to receive a Google
// push notification from — a service account has neither — so polling is
// the only way to notice an edit made directly in the sheet. 2 minutes
// balances "reasonably prompt" against Sheets API quota for a small number
// of connected sheets; not configurable since this is the first scheduled
// job in the codebase and there's no existing convention to extend yet.
const POLL_INTERVAL_MS = 2 * 60 * 1000

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  private readonly logger = new Logger(GoogleSheetsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly client: GoogleSheetsClientService,
    @InjectQueue('google-sheets-sync') private readonly syncQueue: Queue
  ) {}

  // Registers the repeatable poll job on boot. BullMQ dedupes repeatable
  // jobs by their name+repeat-options key, so calling this on every app
  // start is idempotent — it does not create a duplicate schedule.
  async onModuleInit(): Promise<void> {
    await this.syncQueue.add('poll', {}, { repeat: { every: POLL_INTERVAL_MS }, jobId: 'poll' })
  }

  private async isEnabled(): Promise<boolean> {
    const row = await this.prisma.appInstallation.findUnique({ where: { appId: 'google-sheets' } })
    return !!row?.enabled
  }

  private sheetUrl(spreadsheetId: string): string {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  }

  // The live roster for the "Shipping Company" column's dropdown — only
  // linked companies, matching what FulfillmentService.assignShippingCompany
  // itself accepts (an order can't actually be assigned to an unlinked one).
  private async linkedShippingCompanyNames(): Promise<string[]> {
    const companies = await this.prisma.shippingCompany.findMany({ where: { isLinked: true }, select: { name: true } })
    return companies.map((c) => c.name)
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
    const result = await this.client.testConnection(row.spreadsheetId, row.sheetName, await this.linkedShippingCompanyNames())
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

    // A brand-new order is always PendingCallCenter (CallCenter stage) — see
    // OrderState's comment on the 3-stage pipeline — so the initial status
    // always lands in the Call Center column, leaving Fulfillment/Delivery
    // blank until the order actually reaches those stages.
    const statusColumn = resolveStatusColumn(order.state, order.state)
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
      shippingSentLabel(order),
      shippingCompanyLabel(order),
      statusColumn === 'callCenterStatus' ? ORDER_STATE_LABELS[order.state] : '',
      statusColumn === 'fulfillmentStatus' ? ORDER_STATE_LABELS[order.state] : '',
      statusColumn === 'deliveryStatus' ? ORDER_STATE_LABELS[order.state] : '',
      ''
    ]

    const shippingCompanyNames = await this.linkedShippingCompanyNames()
    for (const sheet of targets) {
      try {
        await this.client.ensureHeaderRow(sheet.spreadsheetId, sheet.sheetName, shippingCompanyNames)
        const rowNumber = await this.client.appendRow(sheet.spreadsheetId, sheet.sheetName, row)
        await this.prisma.googleSheetOrderRow.upsert({
          where: { orderId_googleSheetId: { orderId: order.id, googleSheetId: sheet.id } },
          create: { orderId: order.id, googleSheetId: sheet.id, rowNumber },
          update: { rowNumber }
        })
        // appendRow's plain values.append can't set cell formatting — apply
        // the state's color to the one status column that was just written.
        const columnIndex = COLUMN_INDEX[statusColumn]
        await this.client.updateStatusCell(sheet.spreadsheetId, sheet.sheetName, columnIndex, rowNumber, ORDER_STATE_LABELS[order.state], ORDER_STATE_SHEET_COLORS[order.state])
      } catch (error) {
        // One sheet failing (bad id, not shared with the service account,
        // Google having a bad day) must not block the others or the order.
        this.logger.warn(`Failed to push order ${order.id} to sheet ${sheet.id} (${sheet.name}): ${(error as Error).message}`)
      }
    }
  }

  async updateOrderStatus(orderId: string, from: OrderState, to: OrderState): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return

    const rows = await this.prisma.googleSheetOrderRow.findMany({
      where: { orderId },
      include: { googleSheet: true }
    })
    if (!rows.length) return

    const label = ORDER_STATE_LABELS[to]
    const columnIndex = COLUMN_INDEX[resolveStatusColumn(from, to)]
    const color = ORDER_STATE_SHEET_COLORS[to]

    for (const row of rows) {
      if (!row.googleSheet.enabled) continue
      try {
        await this.client.updateStatusCell(row.googleSheet.spreadsheetId, row.googleSheet.sheetName, columnIndex, row.rowNumber, label, color)
      } catch (error) {
        this.logger.warn(`Failed to update status for order ${orderId} in sheet ${row.googleSheetId}: ${(error as Error).message}`)
      }
    }
  }

  // Call-center notes column — plain text, no color/validation. `notes` may
  // be an empty string (cleared) — only skip the write for null/undefined.
  async updateNotes(orderId: string, notes: string | null): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return

    const rows = await this.prisma.googleSheetOrderRow.findMany({
      where: { orderId },
      include: { googleSheet: true }
    })
    if (!rows.length) return

    for (const row of rows) {
      if (!row.googleSheet.enabled) continue
      try {
        await this.client.updateCell(row.googleSheet.spreadsheetId, row.googleSheet.sheetName, GOOGLE_SHEET_COLUMNS.notes, row.rowNumber, notes ?? '')
      } catch (error) {
        this.logger.warn(`Failed to update notes for order ${orderId} in sheet ${row.googleSheetId}: ${(error as Error).message}`)
      }
    }
  }

  // Refreshes the "Sent to Shipping Company" / "Shipping Company" columns —
  // called wherever FulfillmentService changes an order's assignment or
  // dispatch state (assign/dispatch/cancel), since none of those go through
  // updateOrderStatus's OrderState transition (assignment isn't a state).
  async updateShippingInfo(orderId: string): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return

    const rows = await this.prisma.googleSheetOrderRow.findMany({
      where: { orderId },
      include: { googleSheet: true }
    })
    if (!rows.length) return

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { fulfillmentMethod: true, shippingCompany: { select: { name: true } }, shipment: { select: { id: true } } }
    })
    if (!order) return

    const sentLabel = shippingSentLabel(order)
    const companyLabel = shippingCompanyLabel(order)

    for (const row of rows) {
      if (!row.googleSheet.enabled) continue
      try {
        await this.client.updateCell(row.googleSheet.spreadsheetId, row.googleSheet.sheetName, GOOGLE_SHEET_COLUMNS.sentToShippingCompany, row.rowNumber, sentLabel)
        await this.client.updateCell(row.googleSheet.spreadsheetId, row.googleSheet.sheetName, GOOGLE_SHEET_COLUMNS.shippingCompany, row.rowNumber, companyLabel)
      } catch (error) {
        this.logger.warn(`Failed to update shipping info for order ${orderId} in sheet ${row.googleSheetId}: ${(error as Error).message}`)
      }
    }
  }

  // ---- Pull sync — reads back manual edits made directly in a connected
  // sheet (item 2 of the "select in the sheet" request) and applies them to
  // the order, going through the SAME state-machine/assignment rules the
  // admin dashboard itself is bound by, so a sheet edit can't do anything an
  // admin couldn't already do from the order detail page. Driven by the
  // repeatable 'poll' job registered in onModuleInit; also callable directly
  // for an on-demand "Sync now" (see GoogleSheetsController). ----

  async pollAllSheets(): Promise<void> {
    if (!this.client.isConfigured() || !(await this.isEnabled())) return
    const sheets = await this.prisma.googleSheet.findMany({ where: { enabled: true } })
    for (const sheet of sheets) {
      try {
        await this.pollSheet(sheet)
      } catch (error) {
        this.logger.warn(`Google Sheets: poll failed for sheet ${sheet.id} (${sheet.name}): ${(error as Error).message}`)
      }
    }
  }

  private async pollSheet(sheet: { id: string; spreadsheetId: string; sheetName: string }): Promise<void> {
    const orderRows = await this.prisma.googleSheetOrderRow.findMany({ where: { googleSheetId: sheet.id } })
    if (!orderRows.length) return

    const minRow = Math.min(...orderRows.map((r) => r.rowNumber))
    const maxRow = Math.max(...orderRows.map((r) => r.rowNumber))
    const values = await this.client.readEditableRange(sheet.spreadsheetId, sheet.sheetName, minRow, maxRow)
    const byRow = new Map(orderRows.map((r) => [r.rowNumber, r]))

    for (let i = 0; i < values.length; i++) {
      const rowNumber = minRow + i
      const orderRow = byRow.get(rowNumber)
      if (!orderRow) continue
      const cells = values[i] ?? [] // M:Q → [shippingCompany, callCenter, fulfillment, delivery, notes]
      try {
        await this.reconcileRow(orderRow.orderId, {
          shippingCompany: (cells[0] ?? '').trim(),
          callCenterStatus: (cells[1] ?? '').trim(),
          fulfillmentStatus: (cells[2] ?? '').trim(),
          deliveryStatus: (cells[3] ?? '').trim(),
          notes: (cells[4] ?? '').trim()
        })
      } catch (error) {
        this.logger.warn(`Google Sheets: reconcile failed for order ${orderRow.orderId} (row ${rowNumber} of sheet ${sheet.id}): ${(error as Error).message}`)
      }
    }
  }

  private async reconcileRow(
    orderId: string,
    sheetValues: { shippingCompany: string; callCenterStatus: string; fulfillmentStatus: string; deliveryStatus: string; notes: string }
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { state: true, notes: true, fulfillmentMethod: true, shippingCompanyId: true, shippingCompany: { select: { name: true } }, shipment: { select: { id: true } } }
    })
    if (!order) return

    // Notes: only pull in a non-blank sheet value that actually differs —
    // an untouched (still-blank) cell must never clobber an existing note.
    if (sheetValues.notes && sheetValues.notes !== (order.notes ?? '')) {
      await this.prisma.order.update({ where: { id: orderId }, data: { notes: sheetValues.notes } })
      await this.audit.log({
        actor: SHEETS_SYNC_ACTOR,
        action: 'Update',
        entity: 'Order',
        entityId: orderId,
        metadata: { field: 'notes', from: order.notes, to: sheetValues.notes, source: 'google-sheets' }
      })
    }

    // Shipping company / manual assignment — only while still unshipped;
    // once dispatched, reassigning is exactly as unsupported here as it is
    // from the admin UI (cancel the shipment first).
    if (!order.shipment) {
      const currentLabel = shippingCompanyLabel(order)
      if (sheetValues.shippingCompany && sheetValues.shippingCompany !== currentLabel) {
        if (sheetValues.shippingCompany === 'Delivery man') {
          await this.assignManualFromSheet(orderId)
        } else if (sheetValues.shippingCompany !== '—') {
          const company = await this.prisma.shippingCompany.findFirst({ where: { name: sheetValues.shippingCompany, isLinked: true } })
          if (company) await this.assignCompanyFromSheet(orderId, company.id, company.name)
          else this.logger.warn(`Google Sheets: order ${orderId}'s sheet names unknown/unlinked shipping company "${sheetValues.shippingCompany}" — ignored`)
        }
      }
    }

    // Status columns — apply at most one transition per poll pass; a second
    // cell changed in the same pass gets picked up on the next cycle rather
    // than risk chaining two jumps the admin UI would never do in one click.
    const current = await this.prisma.order.findUnique({ where: { id: orderId }, select: { state: true } })
    if (!current) return
    const candidates = [sheetValues.callCenterStatus, sheetValues.fulfillmentStatus, sheetValues.deliveryStatus]
    for (const label of candidates) {
      if (!label) continue
      const targetState = LABEL_TO_STATE[label]
      if (!targetState || targetState === current.state) continue
      if (!isValidTransition(current.state, targetState)) continue
      await this.applyTransitionFromSheet(orderId, current.state, targetState)
      break
    }
  }

  private async applyTransitionFromSheet(orderId: string, from: OrderState, to: OrderState): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { state: to } })
    await this.audit.log({
      actor: SHEETS_SYNC_ACTOR,
      action: 'StateTransition',
      entity: 'Order',
      entityId: orderId,
      metadata: { from, to, source: 'google-sheets' }
    })
    await this.updateOrderStatus(orderId, from, to)
  }

  private async assignManualFromSheet(orderId: string): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { fulfillmentMethod: 'Manual', shippingCompanyId: null } })
    await this.audit.log({
      actor: SHEETS_SYNC_ACTOR,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { assignedShippingCompany: null, manual: true, source: 'google-sheets' }
    })
    await this.updateShippingInfo(orderId)
  }

  private async assignCompanyFromSheet(orderId: string, shippingCompanyId: string, companyName: string): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { fulfillmentMethod: 'ShippingCompany', shippingCompanyId } })
    await this.audit.log({
      actor: SHEETS_SYNC_ACTOR,
      action: 'Update',
      entity: 'Order',
      entityId: orderId,
      metadata: { assignedShippingCompany: companyName, source: 'google-sheets' }
    })
    await this.updateShippingInfo(orderId)
  }
}
