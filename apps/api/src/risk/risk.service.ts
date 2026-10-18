import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  AREA_STATS_DAYS,
  CANCELLED_STATES,
  DELIVERED_STATES,
  FINISHED_STATES,
  RETURNED_STATES,
  UNREACHABLE_STATES,
  autoBlacklistAction,
  computeOrderRisk,
  formatPhoneLocal,
  normalizeAddressKey,
  normalizeAlgerianPhone,
  type AreaStats,
  type BlacklistAction,
  type BlacklistEntryView,
  type BlacklistType,
  type CreateBlacklistEntry,
  type RiskResult,
  type UpdateBlacklistEntry
} from '@amalice/shared'
import type { BlacklistEntry, Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

export interface AddressInput {
  line1: string
  line2?: string | null
  city: string
  region: string
}

export interface RiskAssessment {
  risk: RiskResult
  // Set when a Block entry matches: the order must be refused.
  blockedBy: 'Phone' | 'Address' | null
}

// Shown to the shopper when a blocked phone/address tries to order. Kept
// vague on purpose: it must not tell them which signal tripped.
export const BLOCKED_ORDER_MESSAGE = 'عذراً، لا يمكن قبول هذا الطلب حالياً. يرجى التواصل مع خدمة العملاء.'

const DAY_MS = 24 * 60 * 60 * 1000
const ADDRESS_EXTRA_KEY = /addr|adresse|street|rue|quartier|عنوان|شارع|حي/i

// Lead-form orders keep their free-form fields as JSON in address.line2; only
// the address-like ones belong in the blacklist key (name/notes would make two
// orders to the same door never match).
function addressText(line2: string | null | undefined): string | null {
  if (!line2) return null
  try {
    const parsed: unknown = JSON.parse(line2)
    if (parsed && typeof parsed === 'object') {
      const values = Object.entries(parsed as Record<string, unknown>)
        .filter(([key, value]) => typeof value === 'string' && ADDRESS_EXTRA_KEY.test(key))
        .map(([, value]) => value as string)
      return values.length ? values.join(' ') : null
    }
  } catch {
    // Plain text line2 (storefront checkout form).
  }
  return line2
}

export function addressKeyOf(address: AddressInput): string {
  return normalizeAddressKey([address.line1, addressText(address.line2), address.city, address.region])
}

function toView(entry: BlacklistEntry): BlacklistEntryView {
  return {
    id: entry.id,
    type: entry.type,
    value: entry.value,
    label: entry.label,
    action: entry.action,
    source: entry.source,
    reason: entry.reason,
    active: entry.active,
    createdByEmail: entry.createdByEmail,
    createdAt: entry.createdAt.toISOString()
  }
}

// Fake / returned-order detection: scores each new order (see
// packages/shared risk.ts for the formula), keeps the shared phone/address
// blacklist, and applies the automatic warn/block rule for repeat returners.
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // ---- scoring ------------------------------------------------------------

  // Scores an order about to be placed by `phone` for `address`. Safe to call
  // before the customer/address rows exist. Side effect: applies the
  // automatic blacklist rule (see applyAutoRule).
  async assess(phone: string, address: AddressInput): Promise<RiskAssessment> {
    const customer = await this.prisma.customer.findUnique({ where: { phone }, select: { id: true } })
    const history = customer ? await this.customerHistory(customer.id) : { delivered: 0, returned: 0, cancelled: 0, unreachable: 0, total: 0, last24h: 0 }

    const phoneEntry = await this.applyAutoRule(phone, history.returned)
    const addressKey = addressKeyOf(address)
    const addressEntry = addressKey
      ? await this.prisma.blacklistEntry.findFirst({ where: { type: 'Address', value: addressKey, active: true } })
      : null

    const [wilaya, commune] = await Promise.all([this.areaStats({ region: address.region }), this.areaStats({ region: address.region, city: address.city })])

    const risk = computeOrderRisk({
      history,
      wilaya,
      commune,
      phoneBlacklist: phoneEntry?.action ?? null,
      addressBlacklist: addressEntry?.action ?? null,
      isDuplicate: false
    })
    const blockedBy = phoneEntry?.action === 'Block' ? 'Phone' : addressEntry?.action === 'Block' ? 'Address' : null
    return { risk, blockedBy }
  }

  // Throws the refusal the shopper sees when the assessment says Block.
  assertNotBlocked(assessment: RiskAssessment, phone: string): void {
    if (!assessment.blockedBy) return
    this.logger.warn(`Refused order from ${phone}: ${assessment.blockedBy} is blacklisted`)
    throw new ForbiddenException(BLOCKED_ORDER_MESSAGE)
  }

  private async customerHistory(customerId: string) {
    const rows = await this.prisma.order.findMany({
      where: { customerId, isAbandoned: false, archived: false },
      select: { state: true, createdAt: true },
      take: 200,
      orderBy: { createdAt: 'desc' }
    })
    const count = (states: readonly string[]) => rows.filter((r) => states.includes(r.state)).length
    const dayAgo = Date.now() - DAY_MS
    return {
      delivered: count(DELIVERED_STATES),
      returned: count(RETURNED_STATES),
      cancelled: count(CANCELLED_STATES),
      unreachable: count(UNREACHABLE_STATES),
      total: rows.length,
      last24h: rows.filter((r) => r.createdAt.getTime() >= dayAgo).length
    }
  }

  // Return rate of a wilaya (`region`) or a commune (`region` + `city`) over
  // the last AREA_STATS_DAYS days, from orders with a final outcome.
  private async areaStats(area: { region: string; city?: string }): Promise<AreaStats | null> {
    if (!area.region) return null
    const where: Prisma.OrderWhereInput = {
      isAbandoned: false,
      createdAt: { gte: new Date(Date.now() - AREA_STATS_DAYS * DAY_MS) },
      address: { region: area.region, ...(area.city && { city: area.city }) }
    }
    const [finished, returned] = await Promise.all([
      this.prisma.order.count({ where: { ...where, state: { in: [...FINISHED_STATES] } } }),
      this.prisma.order.count({ where: { ...where, state: { in: [...RETURNED_STATES] } } })
    ])
    return { finished, returned }
  }

  // Customers with repeated returns go on the blacklist by themselves: Warn at
  // AUTO_WARN_RETURNS, Block at AUTO_BLOCK_RETURNS. It is evaluated when they
  // next order (so it needs no hook in every place a return is recorded).
  // An entry that already exists — including one an admin released — is never
  // overwritten, except that an Auto Warn is raised to Block when returns grow.
  private async applyAutoRule(phone: string, returned: number): Promise<BlacklistEntry | null> {
    const existing = await this.prisma.blacklistEntry.findUnique({ where: { type_value: { type: 'Phone', value: phone } } })
    const wanted = autoBlacklistAction(returned)
    if (!wanted) return existing?.active ? existing : null
    if (!existing) {
      const created = await this.prisma.blacklistEntry.create({
        data: { type: 'Phone', value: phone, label: formatPhoneLocal(phone), action: wanted, source: 'Auto', reason: `${returned} returned orders` }
      })
      await this.audit.log({ action: 'Create', entity: 'Blacklist', entityId: created.id, metadata: { type: 'Phone', action: wanted, source: 'Auto', returned } })
      return created
    }
    if (existing.active && existing.source === 'Auto' && existing.action === 'Warn' && wanted === 'Block') {
      const raised = await this.prisma.blacklistEntry.update({ where: { id: existing.id }, data: { action: 'Block', reason: `${returned} returned orders` } })
      await this.audit.log({ action: 'Update', entity: 'Blacklist', entityId: raised.id, metadata: { action: 'Block', source: 'Auto', returned } })
      return raised
    }
    return existing.active ? existing : null
  }

  // ---- blacklist management ----------------------------------------------

  async list(args: { type?: BlacklistType; action?: BlacklistAction; search?: string; includeReleased?: boolean; page: number; pageSize: number }) {
    const search = args.search?.trim()
    const where: Prisma.BlacklistEntryWhereInput = {
      ...(args.includeReleased ? {} : { active: true }),
      ...(args.type && { type: args.type }),
      ...(args.action && { action: args.action }),
      ...(search && { OR: [{ label: { contains: search, mode: 'insensitive' } }, { value: { contains: search, mode: 'insensitive' } }, { reason: { contains: search, mode: 'insensitive' } }] })
    }
    const [rows, total] = await Promise.all([
      this.prisma.blacklistEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (args.page - 1) * args.pageSize, take: args.pageSize }),
      this.prisma.blacklistEntry.count({ where })
    ])
    return { items: rows.map(toView), total, page: args.page, pageSize: args.pageSize }
  }

  async create(input: CreateBlacklistEntry, actor: AuditActor): Promise<BlacklistEntryView> {
    let value: string
    let label: string
    if (input.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: input.orderId }, include: { customer: true, address: true } })
      if (!order) throw new NotFoundException('Order not found')
      if (input.type === 'Phone') {
        value = order.customer.phone
        label = formatPhoneLocal(value)
      } else {
        value = addressKeyOf(order.address)
        label = [order.address.line1, addressText(order.address.line2), order.address.city, order.address.region].filter(Boolean).join(', ')
      }
    } else if (input.type === 'Phone') {
      value = normalizeAlgerianPhone(input.value!)
      if (!/^\+\d{8,15}$/.test(value)) throw new BadRequestException('Invalid phone number')
      label = formatPhoneLocal(value)
    } else {
      value = normalizeAddressKey([input.value!])
      label = input.value!.trim()
    }
    if (!value) throw new BadRequestException('Value is empty')

    const entry = await this.prisma.blacklistEntry.upsert({
      where: { type_value: { type: input.type, value } },
      // Re-adding a released or auto entry takes it over as a manual one.
      update: { active: true, action: input.action, source: 'Manual', reason: input.reason ?? null, label, createdById: actor.id, createdByEmail: actor.email },
      create: { type: input.type, value, label, action: input.action, source: 'Manual', reason: input.reason ?? null, createdById: actor.id, createdByEmail: actor.email }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'Blacklist', entityId: entry.id, metadata: { type: input.type, action: input.action, label, orderId: input.orderId } })
    return toView(entry)
  }

  async update(id: string, input: UpdateBlacklistEntry, actor: AuditActor): Promise<BlacklistEntryView> {
    const existing = await this.prisma.blacklistEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Blacklist entry not found')
    const entry = await this.prisma.blacklistEntry.update({
      where: { id },
      data: { ...(input.action && { action: input.action }), ...(input.reason !== undefined && { reason: input.reason }) }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'Blacklist', entityId: id, metadata: { from: existing.action, to: entry.action } })
    return toView(entry)
  }

  // Soft release: the row stays (active=false) so the automatic rule never
  // re-adds a number an admin deliberately cleared.
  async release(id: string, actor: AuditActor): Promise<{ id: string; active: false }> {
    const existing = await this.prisma.blacklistEntry.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Blacklist entry not found')
    await this.prisma.blacklistEntry.update({ where: { id }, data: { active: false } })
    await this.audit.log({ actor, action: 'Delete', entity: 'Blacklist', entityId: id, metadata: { type: existing.type, label: existing.label } })
    return { id, active: false }
  }

  // What the order page needs to show/offer "blacklist" buttons: the current
  // active entry for this order's phone and address, if any.
  async entriesForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: { select: { phone: true } }, address: true } })
    if (!order) throw new NotFoundException('Order not found')
    const key = addressKeyOf(order.address)
    const [phone, address] = await Promise.all([
      this.prisma.blacklistEntry.findFirst({ where: { type: 'Phone', value: order.customer.phone, active: true } }),
      key ? this.prisma.blacklistEntry.findFirst({ where: { type: 'Address', value: key, active: true } }) : null
    ])
    return { phone: phone ? toView(phone) : null, address: address ? toView(address) : null }
  }
}
