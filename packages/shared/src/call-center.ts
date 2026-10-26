import { z } from 'zod'
import type { OrderState } from './order'

// ---- Call outcomes ----
// What an agent can record after a phone call. Mirrors the Prisma CallOutcome
// enum. 'NoAnswer' / 'WrongNumber' / 'Postponed' may be logged repeatedly on an
// order that is already in the matching state (a retry that fails again) —
// that is why this is a separate "log a call" action and not a plain state
// transition (a transition to the state you're already in is rejected).
export const CallOutcomeSchema = z.enum(['Confirmed', 'NoAnswer', 'WrongNumber', 'Postponed', 'Cancelled'])
export type CallOutcome = z.infer<typeof CallOutcomeSchema>

export const CALL_OUTCOME_TO_STATE: Record<CallOutcome, OrderState> = {
  Confirmed: 'Confirmed',
  NoAnswer: 'CallCenterNoAnswer',
  WrongNumber: 'WrongNumber',
  Postponed: 'Postponed',
  Cancelled: 'Cancelled'
}

// Reverse of the above: the call outcome a plain status change stands for.
export const STATE_TO_CALL_OUTCOME: Partial<Record<OrderState, CallOutcome>> = {
  Confirmed: 'Confirmed',
  CallCenterNoAnswer: 'NoAnswer',
  WrongNumber: 'WrongNumber',
  Postponed: 'Postponed',
  Cancelled: 'Cancelled'
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  Confirmed: 'Confirmed',
  NoAnswer: 'No answer',
  WrongNumber: 'Wrong number',
  Postponed: 'Call back later',
  Cancelled: 'Cancelled'
}

// States an agent works in. Orders in any other state are out of the call
// center's hands, and a CallCenterAgent may not move them.
export const CALL_CENTER_WORK_STATES: readonly OrderState[] = ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed']

// What a call-center agent may look at (not necessarily work): the queues plus
// the outcomes of their calls, so they can see where every order ended up.
export const CALL_CENTER_VIEW_STATES: readonly OrderState[] = [...CALL_CENTER_WORK_STATES, 'Confirmed', 'Cancelled']

// Structured cancellation reasons (reportable, unlike free text).
export const CANCEL_REASONS = [
  { value: 'CustomerRefused', label: 'Customer refused / changed mind' },
  { value: 'TooExpensive', label: 'Price too high' },
  { value: 'DeliveryTooFar', label: 'Delivery fee / location' },
  { value: 'Duplicate', label: 'Duplicate order' },
  { value: 'FakeOrder', label: 'Fake / test order' },
  { value: 'OutOfStock', label: 'Out of stock' },
  { value: 'NotReachable', label: 'Unreachable after many attempts' },
  { value: 'Other', label: 'Other' }
] as const
export const CancelReasonSchema = z.enum(CANCEL_REASONS.map((r) => r.value) as [string, ...string[]])

export const LogCallSchema = z
  .object({
    outcome: CallOutcomeSchema,
    note: z.string().trim().max(1000).optional(),
    reason: z.string().max(60).optional(),
    postponedUntil: z.string().datetime().optional()
  })
  .refine((v) => v.outcome !== 'Postponed' || v.postponedUntil !== undefined, {
    message: 'postponedUntil is required when postponing an order',
    path: ['postponedUntil']
  })
  .refine((v) => v.outcome !== 'Cancelled' || !!v.reason, {
    message: 'A cancellation reason is required',
    path: ['reason']
  })
export type LogCall = z.infer<typeof LogCallSchema>

// ---- Retry policy ----
// A "no answer" order goes back into the dialer queue 3 hours after it was
// marked, whatever the attempt number.
export const CALL_CENTER_MAX_ATTEMPTS = 5
export const NO_ANSWER_COOLDOWN_HOURS = 3
export function noAnswerCooldownHours(_attemptsSoFar?: number): number {
  return NO_ANSWER_COOLDOWN_HOURS
}
export const CALL_LOCK_MINUTES = 10
export const SKIP_DEFER_MINUTES = 30

// ---- API shapes ----
export interface CallAttemptView {
  id: string
  orderId: string
  agentEmail: string | null
  outcome: CallOutcome
  note: string | null
  reason: string | null
  postponedUntil: string | null
  createdAt: string
}

export type CallCenterCounts = Record<CallOutcome, number>

export interface CallCenterStatsResponse {
  // Whole team, today (Algiers day).
  team: CallCenterCounts
  // The requesting agent only.
  me: CallCenterCounts
  // Orders waiting right now, per tier.
  queue: { new: number; noAnswer: number; postponed: number; wrongNumber: number; abandoned: number; dueNow: number }
}

export interface AgentPerformanceRow {
  agentId: string | null
  agentEmail: string
  calls: number
  orders: number
  confirmed: number
  noAnswer: number
  wrongNumber: number
  postponed: number
  cancelled: number
  confirmationRate: number // confirmed / orders worked, 0..1
  confirmedValueCents: number
}

export interface CallCenterReport {
  from: string
  to: string
  totals: CallCenterCounts & { calls: number; orders: number; confirmationRate: number; confirmedValueCents: number }
  agents: AgentPerformanceRow[]
  daily: { date: string; calls: number; confirmed: number; cancelled: number }[]
  cancelReasons: { reason: string; count: number }[]
  // Median minutes between an order being created and its first call.
  medianFirstCallMinutes: number | null
  // Orders still unconfirmed that already hit CALL_CENTER_MAX_ATTEMPTS.
  maxedOutOrders: number
}

export interface CustomerCallHistory {
  totalOrders: number
  delivered: number
  returned: number
  cancelled: number
  inProgress: number
  previous: { id: string; state: OrderState; totalCents: number; createdAt: string }[]
}

// ---- Message templates (WhatsApp / SMS) ----
// Placeholders: {name} {product} {total} {store}. Opened through a wa.me link,
// so no messaging provider is needed.
export const MESSAGE_TEMPLATES = [
  { id: 'confirm', label: 'Confirmation request', text: 'السلام عليكم {name}، معك فريق {store}. طلبك ({product}) بمبلغ {total} في انتظار التأكيد. هل يمكنك تأكيد الطلب؟' },
  { id: 'noanswer', label: 'Could not reach you', text: 'السلام عليكم {name}، حاولنا الاتصال بك بخصوص طلبك ({product}) ولم نتمكن من الوصول إليك. متى يناسبك أن نتصل بك؟' },
  { id: 'wrongnumber', label: 'Number looks wrong', text: 'السلام عليكم، لدينا طلب ({product}) على هذا الرقم ولم نتمكن من التأكد منه. إذا كان الطلب لك فيرجى تأكيد رقم هاتفك الصحيح.' },
  { id: 'reminder', label: 'Callback reminder', text: 'السلام عليكم {name}، نذكّرك بطلبك ({product}) بمبلغ {total}. سنتصل بك في الموعد المتفق عليه.' },
  { id: 'confirmed', label: 'Order confirmed', text: 'شكرًا {name}، تم تأكيد طلبك ({product}) بمبلغ {total} وسيتم شحنه قريبًا. ادفع عند الاستلام.' }
] as const

export function fillMessageTemplate(text: string, vars: { name?: string | null; product?: string; total?: string; store?: string }): string {
  return text
    .replaceAll('{name}', vars.name?.trim() || 'عزيزي الزبون')
    .replaceAll('{product}', vars.product ?? '')
    .replaceAll('{total}', vars.total ?? '')
    .replaceAll('{store}', vars.store ?? 'المتجر')
}

// wa.me wants digits only (E.164 without the +).
export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export function buildSmsUrl(phone: string, text: string): string {
  return `sms:${phone}?body=${encodeURIComponent(text)}`
}
