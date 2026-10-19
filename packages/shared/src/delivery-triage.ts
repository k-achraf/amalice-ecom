import { z } from 'zod'

// ---- AI triage of courier notes on a failed / stuck delivery ----------------
// Drivers' remarks arrive in scrambled French ("client ne repond pas", "adr
// introuvable", "refuse colis"...). The AI reads them for ONE order and returns
// a category plus a suggested next step. It never changes the order.

export const DELIVERY_ISSUE_CATEGORIES = ['NoAnswer', 'WrongAddress', 'WrongNumber', 'Refused', 'CustomerAbsent', 'Postponed', 'CarrierIssue', 'Other'] as const
export const DeliveryIssueCategorySchema = z.enum(DELIVERY_ISSUE_CATEGORIES)
export type DeliveryIssueCategory = z.infer<typeof DeliveryIssueCategorySchema>

export const DELIVERY_NEXT_ACTIONS = ['CallCustomer', 'FixAddress', 'Reschedule', 'Reship', 'CancelOrder', 'ContactCarrier', 'WaitCarrier'] as const
export const DeliveryNextActionSchema = z.enum(DELIVERY_NEXT_ACTIONS)
export type DeliveryNextAction = z.infer<typeof DeliveryNextActionSchema>

export const DELIVERY_CATEGORY_LABELS: Record<DeliveryIssueCategory, string> = {
  NoAnswer: 'Customer did not answer',
  WrongAddress: 'Wrong or incomplete address',
  WrongNumber: 'Wrong phone number',
  Refused: 'Customer refused the parcel',
  CustomerAbsent: 'Customer absent',
  Postponed: 'Delivery postponed',
  CarrierIssue: 'Carrier-side problem',
  Other: 'Other'
}

export const DELIVERY_ACTION_LABELS: Record<DeliveryNextAction, string> = {
  CallCustomer: 'Call the customer',
  FixAddress: 'Correct the address',
  Reschedule: 'Reschedule the delivery',
  Reship: 'Ship again',
  CancelOrder: 'Cancel the order',
  ContactCarrier: 'Contact the carrier',
  WaitCarrier: 'Wait for the carrier'
}

// What the model is asked to produce.
export const DeliveryTriageModelSchema = z.object({
  category: DeliveryIssueCategorySchema,
  summary: z.string().trim().min(1).max(300),
  nextAction: DeliveryNextActionSchema,
  nextStep: z.string().trim().min(1).max(220),
  confidence: z.enum(['high', 'medium', 'low'])
})

export const DeliveryTriageSchema = DeliveryTriageModelSchema.extend({
  // False when the order has no courier remarks to read (nothing was asked of the AI).
  hasNotes: z.boolean(),
  notesUsed: z.number().int().min(0)
})
export type DeliveryTriage = z.infer<typeof DeliveryTriageSchema>
