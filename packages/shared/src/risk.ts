import { z } from 'zod'
import type { OrderState } from './order'

// ---- Fake / returned-order detection ---------------------------------------
// COD's biggest loss is the order that's refused at the door or never
// answered. Every new order is scored 0-100 at creation time from the
// customer's history and the delivery area's track record, and the phone /
// address can be put on a shared blacklist (warn = order flagged for the call
// center, block = order refused at checkout). The scoring is a pure function
// so the API, tests and any UI preview agree on one definition.

// Outcomes of a past order. Mirrors admin-call-center's customerHistory sets
// (DeliveryFailed counts as a return there too) so the two never disagree.
export const DELIVERED_STATES: readonly OrderState[] = ['Delivered', 'CashCollected', 'Reconciled', 'Settled']
export const RETURNED_STATES: readonly OrderState[] = ['ReturnedToOrigin', 'Restocked', 'DeliveryFailed']
export const CANCELLED_STATES: readonly OrderState[] = ['Cancelled', 'CancelledShipping']
// The call center never reached the customer (or reached a wrong number).
export const UNREACHABLE_STATES: readonly OrderState[] = ['WrongNumber', 'CallCenterNoAnswer']
// Orders that have a final delivered/returned outcome — the denominator of a
// return rate (in-flight orders say nothing yet).
export const FINISHED_STATES: readonly OrderState[] = [...DELIVERED_STATES, ...RETURNED_STATES]

export const RiskLevelSchema = z.enum(['Low', 'Medium', 'High'])
export type RiskLevel = z.infer<typeof RiskLevelSchema>

export const BlacklistTypeSchema = z.enum(['Phone', 'Address'])
export type BlacklistType = z.infer<typeof BlacklistTypeSchema>

// Warn = still accepted, flagged High risk for the call center.
// Block = refused at checkout.
export const BlacklistActionSchema = z.enum(['Warn', 'Block'])
export type BlacklistAction = z.infer<typeof BlacklistActionSchema>

export const BlacklistSourceSchema = z.enum(['Manual', 'Auto'])
export type BlacklistSource = z.infer<typeof BlacklistSourceSchema>

// ---- Tunables ---------------------------------------------------------------
// A customer with this many returned orders is put on the blacklist
// automatically the next time they order (Warn first, Block after).
export const AUTO_WARN_RETURNS = 2
export const AUTO_BLOCK_RETURNS = 3
export const RISK_MEDIUM_FROM = 30
export const RISK_HIGH_FROM = 60
// Minimum finished orders before an area's return rate is trusted.
export const WILAYA_MIN_SAMPLE = 20
export const COMMUNE_MIN_SAMPLE = 8
// Window used for the area return rates.
export const AREA_STATS_DAYS = 180

export interface AreaStats {
  finished: number
  returned: number
}

export interface RiskInput {
  history: {
    delivered: number
    returned: number
    cancelled: number
    unreachable: number
    // Real (non-abandoned) orders before this one.
    total: number
    // Other real orders by this customer in the last 24h.
    last24h: number
  }
  wilaya: AreaStats | null
  commune: AreaStats | null
  phoneBlacklist: BlacklistAction | null
  addressBlacklist: BlacklistAction | null
  isDuplicate: boolean
}

export const RISK_FACTOR_LABELS: Record<string, string> = {
  PHONE_BLACKLISTED: 'Phone number is blacklisted',
  ADDRESS_BLACKLISTED: 'Address is blacklisted',
  PREVIOUS_RETURNS: 'Previous returned orders',
  HIGH_RETURN_RATE: 'High personal return rate',
  PREVIOUS_CANCELLED: 'Previous cancelled / wrong-number orders',
  UNREACHABLE: 'Previously unreachable by phone',
  DUPLICATE_ORDER: 'Possible duplicate order',
  FIRST_ORDER: 'First order, no history',
  ORDER_BURST: 'Several orders in 24 hours',
  WILAYA_RETURN_RATE: 'Wilaya has a high return rate',
  COMMUNE_RETURN_RATE: 'Commune has a high return rate',
  GOOD_HISTORY: 'Reliable customer (delivered, no returns)'
}

// A type alias (not an interface) so it is assignable to Prisma's JSON input.
export type RiskFactor = {
  code: string
  points: number
  // Short human detail, e.g. "2 returned", "38% of 40 orders".
  detail?: string
}

export interface RiskResult {
  score: number
  level: RiskLevel
  factors: RiskFactor[]
}

export function riskLevelFor(score: number): RiskLevel {
  return score >= RISK_HIGH_FROM ? 'High' : score >= RISK_MEDIUM_FROM ? 'Medium' : 'Low'
}

const pct = (n: number, d: number) => Math.round((n / d) * 100)

export function computeOrderRisk(input: RiskInput): RiskResult {
  const { history: h } = input
  const factors: RiskFactor[] = []
  const add = (code: string, points: number, detail?: string) => factors.push({ code, points, ...(detail && { detail }) })

  if (input.phoneBlacklist) add('PHONE_BLACKLISTED', input.phoneBlacklist === 'Block' ? 100 : 60)
  if (input.addressBlacklist) add('ADDRESS_BLACKLISTED', input.addressBlacklist === 'Block' ? 100 : 50)

  if (h.returned > 0) {
    add('PREVIOUS_RETURNS', h.returned >= 3 ? 60 : h.returned === 2 ? 45 : 25, `${h.returned} returned`)
  }
  const finished = h.delivered + h.returned
  if (finished >= 3 && h.returned / finished >= 0.5) {
    add('HIGH_RETURN_RATE', 15, `${pct(h.returned, finished)}% of ${finished} orders`)
  }
  if (h.cancelled > 0) add('PREVIOUS_CANCELLED', Math.min(15, h.cancelled * 5), `${h.cancelled} cancelled`)
  if (h.unreachable > 0) add('UNREACHABLE', Math.min(15, h.unreachable * 5), `${h.unreachable} no answer / wrong number`)
  if (input.isDuplicate) add('DUPLICATE_ORDER', 10)
  if (h.total === 0) add('FIRST_ORDER', 5)
  if (h.last24h >= 2) add('ORDER_BURST', 15, `${h.last24h + 1} orders in 24h`)

  const w = input.wilaya
  if (w && w.finished >= WILAYA_MIN_SAMPLE) {
    const rate = w.returned / w.finished
    if (rate >= 0.4) add('WILAYA_RETURN_RATE', 15, `${pct(w.returned, w.finished)}% of ${w.finished} orders`)
    else if (rate >= 0.25) add('WILAYA_RETURN_RATE', 8, `${pct(w.returned, w.finished)}% of ${w.finished} orders`)
  }
  const c = input.commune
  if (c && c.finished >= COMMUNE_MIN_SAMPLE) {
    const rate = c.returned / c.finished
    if (rate >= 0.5) add('COMMUNE_RETURN_RATE', 15, `${pct(c.returned, c.finished)}% of ${c.finished} orders`)
    else if (rate >= 0.3) add('COMMUNE_RETURN_RATE', 8, `${pct(c.returned, c.finished)}% of ${c.finished} orders`)
  }

  if (h.delivered >= 2 && h.returned === 0 && h.cancelled === 0) add('GOOD_HISTORY', -15, `${h.delivered} delivered`)

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)))
  return { score, level: riskLevelFor(score), factors }
}

// Adds a factor discovered after the first scoring pass (the duplicate flag is
// only known once the order's customer row exists).
export function addRiskFactor(result: RiskResult, factor: RiskFactor): RiskResult {
  const factors = [...result.factors, factor]
  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)))
  return { score, level: riskLevelFor(score), factors }
}

// What the automatic rule does for a customer with this many returns:
// null = nothing yet.
export function autoBlacklistAction(returned: number): BlacklistAction | null {
  return returned >= AUTO_BLOCK_RETURNS ? 'Block' : returned >= AUTO_WARN_RETURNS ? 'Warn' : null
}

// Canonical form of an address for blacklist matching: lowercase, accents and
// punctuation stripped, whitespace collapsed. Arabic letters are kept.
export function normalizeAddressKey(parts: Array<string | null | undefined>): string {
  return parts
    .filter((p): p is string => !!p)
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// ---- Blacklist API shapes ---------------------------------------------------
export const CreateBlacklistEntrySchema = z
  .object({
    type: BlacklistTypeSchema,
    // A phone number (any Algerian format), or an address text. Alternatively
    // give `orderId` and the order's customer phone / delivery address is used.
    value: z.string().trim().min(3).max(500).optional(),
    orderId: z.uuid().optional(),
    action: BlacklistActionSchema,
    reason: z.string().trim().max(300).optional()
  })
  .refine((v) => v.value || v.orderId, { message: 'Provide a value or an orderId' })
export type CreateBlacklistEntry = z.infer<typeof CreateBlacklistEntrySchema>

export const UpdateBlacklistEntrySchema = z.object({
  action: BlacklistActionSchema.optional(),
  reason: z.string().trim().max(300).nullable().optional()
})
export type UpdateBlacklistEntry = z.infer<typeof UpdateBlacklistEntrySchema>

export interface BlacklistEntryView {
  id: string
  type: BlacklistType
  value: string
  // For phones this is the number, for addresses a readable form.
  label: string
  action: BlacklistAction
  source: BlacklistSource
  reason: string | null
  active: boolean
  createdByEmail: string | null
  createdAt: string
}
