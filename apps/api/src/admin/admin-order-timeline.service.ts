import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CALL_CENTER_VIEW_STATES,
  CALL_OUTCOME_LABELS,
  CANCEL_REASONS,
  DHD_WEBHOOK_EVENT_TO_STATE,
  ORDER_STAGE_BY_STATE,
  ORDER_STATE_LABELS,
  courierStatusLabel,
  normalizeCourierStatus,
  type ActivityFeedResponse,
  type CallOutcome,
  type OrderCourierSection,
  type OrderMilestones,
  type OrderState,
  type OrderTimelineEvent,
  type OrderTimelineResponse,
  type TimelineCategory,
  type TimelineTone
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

type Meta = Record<string, unknown>
const SYSTEM_SOURCES: Record<string, string> = {
  'dhd-webhook': 'Courier webhook',
  'courier-sync': 'Courier sync',
  'courier-refresh': 'Courier sync',
  'google-sheets': 'Google Sheets',
  sheets: 'Google Sheets'
}

const dzd = (cents: unknown) => (typeof cents === 'number' ? `${Math.round(cents / 100).toLocaleString('en')} DA` : '—')
const label = (state: unknown) => (typeof state === 'string' ? (ORDER_STATE_LABELS[state as OrderState] ?? state) : '—')

function stateTone(state: OrderState): TimelineTone {
  if (['Confirmed', 'Packed', 'Delivered', 'CashCollected', 'Reconciled', 'Settled', 'HandedToCourier', 'OutForDelivery'].includes(state)) return 'good'
  if (['Cancelled', 'CancelledShipping', 'WrongNumber', 'DeliveryFailed', 'ReturnedToOrigin'].includes(state)) return 'bad'
  if (['CallCenterNoAnswer', 'Postponed', 'OnHold'].includes(state)) return 'warn'
  return 'neutral'
}

// Our own status changes are never filed under "courier": even when a courier
// webhook or sync caused one, it is OUR order moving to a new state. The courier's
// own report of the parcel lives in its separate section (OrderCourierSection).
function stateCategory(state: OrderState): TimelineCategory {
  const stage = ORDER_STAGE_BY_STATE[state]
  if (stage === 'Finance') return 'finance'
  if (stage === 'Shipping' || state === 'Packed' || state === 'OnHold') return 'shipping'
  return 'order'
}

interface AuditRow {
  id: string
  actorEmail: string | null
  action: string
  entity: string
  entityId: string
  metadata: unknown
  createdAt: Date
}

// Builds the order tracking record: one chronological list merged from every
// place something about an order is written — the audit log (status changes,
// edits, our shipping actions), the call log, the courier's permanent history
// (ShipmentEvent), webhook deliveries, notifications and finance rows.
@Injectable()
export class AdminOrderTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- mapping ------------------------------------------------------------

  private actorOf(row: AuditRow, meta: Meta): string {
    if (row.actorEmail) return row.actorEmail
    const source = typeof meta.source === 'string' ? meta.source : null
    return (source && SYSTEM_SOURCES[source]) || (source ? source : 'System')
  }

  private auditEvent(row: AuditRow, productNames: Map<string, string>): OrderTimelineEvent | null {
    const meta = (row.metadata ?? {}) as Meta
    const base = { id: `audit:${row.id}`, at: row.createdAt.toISOString(), actor: this.actorOf(row, meta), orderId: row.entityId }
    const ev = (category: TimelineCategory, tone: TimelineTone, title: string, detail: string | null = null): OrderTimelineEvent => ({ ...base, category, tone, title, detail })

    if (row.entity === 'Order' && row.action === 'Delete') {
      return ev('order', 'bad', 'Order deleted', 'Permanently removed by a SuperAdmin')
    }

    if (row.action === 'StateTransition' && row.entity === 'Order') {
      const to = meta.to as OrderState
      const from = meta.from
      const parts: string[] = []
      if (typeof meta.callOutcome === 'string') parts.push(`Call outcome: ${CALL_OUTCOME_LABELS[meta.callOutcome as CallOutcome] ?? meta.callOutcome}`)
      if (typeof meta.reason === 'string') parts.push(`Reason: ${CANCEL_REASONS.find((r) => r.value === meta.reason)?.label ?? meta.reason}`)
      if (typeof meta.postponedUntil === 'string') parts.push(`Call back ${new Date(meta.postponedUntil).toLocaleString()}`)
      if (meta.convertedFromAbandoned) parts.push('Converted from an abandoned cart')
      if (typeof meta.trackingReference === 'string' && meta.trackingReference) parts.push(`Tracking ${meta.trackingReference}`)
      if (typeof meta.courier === 'string') parts.push(`Courier: ${meta.courier}`)
      if (meta.manual) parts.push('Recorded manually')
      if (typeof meta.courierStatus === 'string') parts.push(`Courier status: ${courierStatusLabel(meta.courierStatus)}`)
      if (typeof meta.event === 'string') parts.push(`Event: ${meta.event}`)
      if (meta.dhdAction === 'cancel') parts.push('Shipment cancelled at the courier')
      if (meta.dhdAction === 'validate-returns') parts.push('Return receipt confirmed with the courier')
      return ev(stateCategory(to), stateTone(to), `${label(from)} → ${label(to)}`, parts.join(' · ') || null)
    }

    if (row.entity === 'LedgerEntry') {
      return ev('finance', 'neutral', 'Cash discrepancy resolved', typeof meta.note === 'string' ? meta.note : null)
    }

    if (row.entity !== 'Order') return null

    if (meta.field === 'price') {
      const f = (meta.from ?? {}) as Meta
      const t = (meta.to ?? {}) as Meta
      return ev('edit', 'warn', 'Price changed', `Delivery ${dzd(f.shippingPriceCents)} → ${dzd(t.shippingPriceCents)} · Total ${dzd(f.totalCents)} → ${dzd(t.totalCents)}`)
    }
    if (meta.field === 'notes') {
      const clip = (v: unknown) => (typeof v === 'string' ? (v.length > 80 ? `${v.slice(0, 80)}…` : v) : '—')
      return ev('edit', 'neutral', 'Notes edited', `${clip(meta.from)} → ${clip(meta.to)}`)
    }
    if (meta.field === 'customerInfo') {
      const changes = (meta.changes ?? {}) as Record<string, { from: unknown; to: unknown }>
      const names: Record<string, string> = { customerName: 'Name', customerPhone: 'Phone', wilaya: 'Wilaya', commune: 'Commune', addressLine1: 'Address', shippingType: 'Delivery type' }
      return ev('edit', 'neutral', 'Customer / delivery details edited', Object.entries(changes).map(([k, v]) => `${names[k] ?? k}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`).join(' · ') || null)
    }
    if (meta.field === 'deliveryInfo') {
      const changes = (meta.changes ?? {}) as Meta
      const names: Record<string, string> = { deliveryNote: 'Remark', isFragile: 'Fragile', gpsLink: 'GPS link', courierOperation: 'Operation', exchangeProduct: 'Exchange product' }
      return ev('edit', 'neutral', 'Courier details edited', Object.entries(changes).map(([k, v]) => `${names[k] ?? k}: ${String(v ?? '—')}`).join(' · ') || null)
    }
    if (meta.addedItem) {
      const item = meta.addedItem as { productId?: string; quantity?: number; unitPriceCents?: number; isUpsell?: boolean }
      const name = (item.productId && productNames.get(item.productId)) || 'product'
      return ev('edit', 'good', item.isUpsell ? 'Upsell added' : 'Item added', `${item.quantity ?? 1} × ${name} at ${dzd(item.unitPriceCents)}`)
    }
    if (typeof meta.archived === 'boolean') return ev('order', 'neutral', meta.archived ? 'Archived' : 'Restored from the archive')
    if (typeof meta.callCenter === 'string') return ev('call', 'neutral', meta.callCenter === 'claimed' ? 'Taken by an agent' : 'Skipped for now')
    if ('assignedShippingCompany' in meta) {
      return ev('shipping', 'neutral', meta.manual ? 'Assigned to own delivery' : `Assigned to ${String(meta.assignedShippingCompany)}`)
    }
    switch (meta.dhdAction) {
      case 'expedier': return ev('shipping', 'good', 'Confirmed with the courier', `Tracking ${String(meta.trackingReference ?? '—')} · they will collect the parcel`)
      case 'update': return ev('shipping', 'neutral', 'Shipment edited at the courier', `Tracking ${String(meta.trackingReference ?? '—')}`)
      case 'add-maj': return ev('shipping', 'neutral', 'Note sent to the courier', typeof meta.content === 'string' ? meta.content : null)
      case 'ask-return': return ev('shipping', 'warn', 'Return requested from the courier', `Tracking ${String(meta.trackingReference ?? '—')}`)
      case 'cancel': return ev('shipping', 'warn', 'Shipment cancelled', `Tracking ${String(meta.trackingReference ?? '—')} · back to Packed`)
      default: break
    }
    return ev('edit', 'neutral', row.action === 'Create' ? 'Created' : 'Updated', null)
  }

  private callEvent(c: { id: string; orderId: string; agentEmail: string | null; outcome: CallOutcome; note: string | null; reason: string | null; postponedUntil: Date | null; createdAt: Date }): OrderTimelineEvent {
    const parts: string[] = []
    if (c.reason) parts.push(`Reason: ${CANCEL_REASONS.find((r) => r.value === c.reason)?.label ?? c.reason}`)
    if (c.postponedUntil) parts.push(`Call back ${c.postponedUntil.toLocaleString()}`)
    if (c.note) parts.push(c.note)
    const tone: TimelineTone = c.outcome === 'Confirmed' ? 'good' : c.outcome === 'Cancelled' || c.outcome === 'WrongNumber' ? 'bad' : 'warn'
    return { id: `call:${c.id}`, at: c.createdAt.toISOString(), category: 'call', tone, title: `Call — ${CALL_OUTCOME_LABELS[c.outcome]}`, detail: parts.join(' · ') || null, actor: c.agentEmail ?? 'Agent', orderId: c.orderId }
  }

  private shipmentEvent(e: { id: string; orderId: string; kind: string; title: string; details: string | null; station: string | null; driver: string | null; occurredAt: Date }): OrderTimelineEvent {
    const parts = [e.details, e.station ? `Station: ${e.station}` : null, e.driver ? `Driver: ${e.driver}` : null].filter(Boolean)
    const bad = /absent|ne r[ée]pond|refus|annul|retour|suspend|failed/i.test(`${e.title} ${e.details ?? ''}`)
    return { id: `ship:${e.id}`, at: e.occurredAt.toISOString(), category: 'courier', tone: bad ? 'warn' : 'neutral', title: e.title, detail: parts.join(' · ') || null, actor: e.kind === 'remark' ? (e.driver ? `Courier — ${e.driver}` : 'Courier') : 'Courier', orderId: e.orderId }
  }

  private webhookEvent(w: { id: string; orderId: string | null; event: string; applied: boolean; error: string | null; receivedAt: Date }): OrderTimelineEvent {
    const target = DHD_WEBHOOK_EVENT_TO_STATE[w.event]
    const detail = w.error ? `Not applied: ${w.error}` : w.applied && target ? `Moved the order to ${label(target)}` : 'Information only'
    return { id: `hook:${w.id}`, at: w.receivedAt.toISOString(), category: 'courier', tone: w.error ? 'warn' : 'neutral', title: `Courier webhook: ${w.event.replace(/^order\./, '').replace(/_/g, ' ')}`, detail, actor: 'Courier', ...(w.orderId && { orderId: w.orderId }) }
  }

  // ---- per-order timeline ----------------------------------------------------

  async timeline(orderId: string, role?: string): Promise<OrderTimelineResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { name: true, phone: true } },
        items: { include: { product: { select: { name: true } } } },
        shipment: { include: { courier: { select: { name: true } } } },
        cashReconciliation: true
      }
    })
    if (!order) throw new NotFoundException('Order not found')
    if (role === 'CallCenterAgent' && !CALL_CENTER_VIEW_STATES.includes(order.state)) {
      throw new ForbiddenException('This order is outside the call center')
    }

    const ledger = await this.prisma.ledgerEntry.findMany({ where: { orderId }, include: { batch: { select: { reference: true } } } })
    const [audits, calls, shipmentEvents, webhooks, notifications, ledgerAudits] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { entity: 'Order', entityId: orderId }, orderBy: { createdAt: 'asc' }, take: 1000 }),
      this.prisma.callAttempt.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.shipmentEvent.findMany({ where: { orderId }, orderBy: { occurredAt: 'asc' } }),
      this.prisma.courierWebhookEvent.findMany({ where: { orderId }, orderBy: { receivedAt: 'asc' } }),
      this.prisma.notification.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
      ledger.length ? this.prisma.auditLog.findMany({ where: { entity: 'LedgerEntry', entityId: { in: ledger.map((l) => l.id) } } }) : Promise.resolve([])
    ])

    const productIds = new Set<string>()
    for (const a of audits) {
      const item = ((a.metadata ?? {}) as Meta).addedItem as { productId?: string } | undefined
      if (item?.productId) productIds.add(item.productId)
    }
    const products = productIds.size ? await this.prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true } }) : []
    const productNames = new Map(products.map((p) => [p.id, p.name]))

    const events: OrderTimelineEvent[] = []

    // Placement: the order row is the only record of how it started.
    const itemsText = order.items.map((i) => `${i.quantity} × ${i.product.name}`).join(', ')
    events.push({
      id: 'order:created',
      at: order.createdAt.toISOString(),
      category: 'order',
      tone: 'neutral',
      title: order.isAbandoned ? 'Abandoned cart captured' : 'Order placed',
      detail: [itemsText, `Total ${dzd(order.totalCents)} (cash on delivery)`, order.isDuplicate ? 'Flagged as a possible duplicate' : null].filter(Boolean).join(' · '),
      actor: 'Customer',
      orderId
    })
    for (const a of audits) {
      const e = this.auditEvent(a as AuditRow, productNames)
      if (e) events.push(e)
    }
    for (const a of ledgerAudits) {
      const e = this.auditEvent(a as AuditRow, productNames)
      if (e) events.push({ ...e, orderId })
    }
    for (const c of calls) events.push(this.callEvent(c as never))
    for (const n of notifications) {
      events.push({ id: `notif:${n.id}`, at: n.createdAt.toISOString(), category: 'notification', tone: n.status === 'Failed' ? 'bad' : 'neutral', title: `${n.channel} message — ${n.status}`, detail: `To ${n.recipient}: ${n.message}${n.lastError ? ` (${n.lastError})` : ''}`, actor: 'System', orderId })
    }
    for (const l of ledger) {
      events.push({ id: `ledger:${l.id}`, at: l.createdAt.toISOString(), category: 'finance', tone: l.status === 'Matched' || l.status === 'Resolved' ? 'good' : 'warn', title: `Cash handover line — ${l.status}`, detail: `Collected ${dzd(l.collectedCents)}${l.expectedCents != null ? ` of ${dzd(l.expectedCents)} expected` : ''} · batch ${l.batch.reference}${l.resolutionNote ? ` · ${l.resolutionNote}` : ''}`, actor: 'Finance', orderId })
    }
    if (order.cashReconciliation?.reconciledAt) {
      const r = order.cashReconciliation
      events.push({ id: `recon:${r.id}`, at: r.reconciledAt!.toISOString(), category: 'finance', tone: r.matched ? 'good' : 'warn', title: r.matched ? 'Cash reconciled' : 'Cash reconciled with a difference', detail: `Collected ${dzd(r.collectedCents)} of ${dzd(r.expectedCents)} expected`, actor: 'Finance', orderId })
    }

    events.sort((a, b) => a.at.localeCompare(b.at))

    // ---- milestones from the first time each status was reached ----
    const firstTo = (state: OrderState) => {
      const a = audits.find((x) => x.action === 'StateTransition' && ((x.metadata ?? {}) as Meta).to === state)
      return a ? a.createdAt : null
    }
    const firstCall = calls[0]?.createdAt ?? null
    const confirmedAt = firstTo('Confirmed') ?? calls.find((c) => c.outcome === 'Confirmed')?.createdAt ?? null
    const iso = (d: Date | null) => (d ? d.toISOString() : null)
    const milestones: OrderMilestones = {
      placedAt: order.createdAt.toISOString(),
      firstCallAt: iso(firstCall),
      confirmedAt: iso(confirmedAt),
      packedAt: iso(firstTo('Packed')),
      shippedAt: iso(firstTo('HandedToCourier')),
      outForDeliveryAt: iso(firstTo('OutForDelivery')),
      deliveredAt: iso(firstTo('Delivered')),
      returnedAt: iso(firstTo('ReturnedToOrigin')),
      cancelledAt: iso(firstTo('Cancelled') ?? firstTo('CancelledShipping')),
      cashCollectedAt: iso(firstTo('CashCollected')),
      settledAt: iso(firstTo('Settled'))
    }
    const minutes = (from: string | null, to: string | null) => (from && to ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)) : null)
    const end = milestones.deliveredAt ?? milestones.returnedAt ?? milestones.cancelledAt

    // ---- the courier's own section ----
    const shipment = order.shipment
    let courier: OrderCourierSection | null = null
    if (shipment) {
      const courierEvents = [...shipmentEvents.map((e) => this.shipmentEvent(e)), ...webhooks.map((w) => this.webhookEvent(w))].sort((a, b) => a.at.localeCompare(b.at))
      const desk = shipment.deskInfo as OrderCourierSection['desk']
      const code = shipment.courierStatus && shipment.courierStatus !== 'manual_dispatch' ? shipment.courierStatus : null
      courier = {
        courierName: shipment.courier.name,
        trackingReference: shipment.trackingReference,
        viaApi: shipment.courierStatus !== 'manual_dispatch' && !!shipment.trackingReference,
        confirmed: !!shipment.carrierConfirmedAt,
        confirmedAt: shipment.carrierConfirmedAt?.toISOString() ?? null,
        statusCode: code,
        statusLabel: code ? courierStatusLabel(code) : null,
        driverName: shipment.driverName,
        driverPhone: shipment.driverPhone,
        desk: desk ?? null,
        lastFailureReason: shipment.lastFailureReason,
        postponedTo: shipment.postponedTo?.toISOString() ?? null,
        carrierFeeCents: shipment.carrierFeeCents,
        returnFeeCents: shipment.returnFeeCents,
        lastSyncedAt: shipment.lastSyncedAt?.toISOString() ?? null,
        events: courierEvents
      }
    }

    return {
      orderId,
      state: order.state,
      trackingReference: order.shipment?.trackingReference ?? null,
      courierName: order.shipment?.courier.name ?? null,
      courierStatus: order.shipment?.courierStatus ?? null,
      courier,
      totalCalls: calls.length,
      actors: [...new Set(events.map((e) => e.actor).filter((a) => a.includes('@')))],
      milestones,
      durations: {
        toFirstCall: minutes(milestones.placedAt, milestones.firstCallAt),
        toConfirm: minutes(milestones.placedAt, milestones.confirmedAt),
        confirmToShip: minutes(milestones.confirmedAt, milestones.shippedAt),
        shipToDelivery: minutes(milestones.shippedAt, milestones.deliveredAt),
        total: minutes(milestones.placedAt, end)
      },
      events
    }
  }

  // ---- global activity feed ------------------------------------------------------

  // Latest operations across all orders, newest first. Pages by time: pass the
  // previous response's nextBefore as `before`.
  async activity(args: { before?: Date; limit: number; category?: TimelineCategory; actor?: string }): Promise<ActivityFeedResponse> {
    const before = args.before ?? new Date()
    const take = Math.min(args.limit * 3, 600)
    const actorFilter = args.actor ? { contains: args.actor, mode: 'insensitive' as const } : undefined

    const [audits, calls, shipmentEvents] = await Promise.all([
      this.prisma.auditLog.findMany({ where: { entity: 'Order', createdAt: { lt: before }, ...(actorFilter && { actorEmail: actorFilter }) }, orderBy: { createdAt: 'desc' }, take }),
      this.prisma.callAttempt.findMany({ where: { createdAt: { lt: before }, ...(actorFilter && { agentEmail: actorFilter }) }, orderBy: { createdAt: 'desc' }, take }),
      actorFilter ? Promise.resolve([]) : this.prisma.shipmentEvent.findMany({ where: { occurredAt: { lt: before } }, orderBy: { occurredAt: 'desc' }, take })
    ])
    const productIds = new Set<string>()
    for (const a of audits) {
      const item = ((a.metadata ?? {}) as Meta).addedItem as { productId?: string } | undefined
      if (item?.productId) productIds.add(item.productId)
    }
    const products = productIds.size ? await this.prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true } }) : []
    const names = new Map(products.map((p) => [p.id, p.name]))

    let events: OrderTimelineEvent[] = []
    for (const a of audits) {
      const e = this.auditEvent(a as AuditRow, names)
      if (e) events.push(e)
    }
    for (const c of calls) events.push(this.callEvent(c as never))
    for (const e of shipmentEvents) events.push(this.shipmentEvent(e))
    // A source that returned a full batch may have older rows we didn't read:
    // only events newer than its last row are complete, so cut there and let the
    // next page continue from that point (no gaps, no duplicates).
    const cuts: string[] = []
    if (audits.length === take) cuts.push(audits[audits.length - 1]!.createdAt.toISOString())
    if (calls.length === take) cuts.push(calls[calls.length - 1]!.createdAt.toISOString())
    if (shipmentEvents.length === take) cuts.push(shipmentEvents[shipmentEvents.length - 1]!.occurredAt.toISOString())
    const cut = cuts.length ? cuts.sort().pop()! : null
    if (cut) events = events.filter((e) => e.at >= cut)
    if (args.category) events = events.filter((e) => e.category === args.category)
    events.sort((a, b) => b.at.localeCompare(a.at))
    const page = events.slice(0, args.limit)
    return { events: page, nextBefore: events.length > args.limit ? page[page.length - 1]!.at : cut }
  }
}
