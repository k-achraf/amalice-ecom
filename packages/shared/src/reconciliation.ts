import { z } from 'zod'

// FIN-01 — reconciliation. RemittanceBatch is one courier cash handover;
// LedgerEntry is one order's line within a batch. Both are immutable once
// committed (plan §7 — corrections are new entries, not edits).

export const RemittanceBatchStatusSchema = z.enum(['Imported', 'Matched', 'Settled', 'Discrepancy'])
export type RemittanceBatchStatus = z.infer<typeof RemittanceBatchStatusSchema>

export const LedgerEntryStatusSchema = z.enum(['Matched', 'Mismatch', 'Unmatched', 'Resolved'])
export type LedgerEntryStatus = z.infer<typeof LedgerEntryStatusSchema>

export const LedgerEntrySchema = z.object({
  id: z.uuid(),
  batchId: z.uuid(),
  orderId: z.uuid().nullable().optional(),
  courierRef: z.string(),
  expectedCents: z.number().int().nullable().optional(),
  collectedCents: z.number().int(),
  status: LedgerEntryStatusSchema,
  resolutionNote: z.string().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional()
})
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>

export const RemittanceBatchSchema = z.object({
  id: z.uuid(),
  courierId: z.uuid(),
  courierName: z.string().nullable().optional(),
  reference: z.string(),
  periodStart: z.string().datetime().nullable().optional(),
  periodEnd: z.string().datetime().nullable().optional(),
  totalCents: z.number().int(),
  status: RemittanceBatchStatusSchema,
  createdAt: z.string().datetime().nullable().optional()
})
export type RemittanceBatch = z.infer<typeof RemittanceBatchSchema>

// FIN-02 — remittance import. Each row is one order's collected amount as
// reported by the courier. Validated per-row before commit; partial failure
// produces a per-row error report, never a silent partial import.
export const RemittanceRowSchema = z.object({
  courierRef: z.string().min(1).max(200),
  collectedCents: z.number().int().nonnegative()
})
export type RemittanceRow = z.infer<typeof RemittanceRowSchema>

export const ImportRemittanceSchema = z.object({
  courierId: z.uuid(),
  reference: z.string().min(1).max(200),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  rows: z.array(RemittanceRowSchema).min(1)
})
export type ImportRemittance = z.infer<typeof ImportRemittanceSchema>

// FIN-04 — discrepancy resolution. Accept-with-reason or reject-and-escalate;
// each is itself an audit-logged event.
export const ResolveDiscrepancySchema = z.object({
  resolutionNote: z.string().min(1).max(1000)
})
export type ResolveDiscrepancy = z.infer<typeof ResolveDiscrepancySchema>

// ADM-09 — dashboard KPIs. One shape for the operations overview.
export interface DashboardStats {
  ordersToday: number
  codAmountPendingCents: number
  codAmountCollectedCents: number
  pendingCallCenterCount: number
  confirmedCount: number
  packedCount: number
  deliveriesToday: number
  rtoCount30d: number
  totalOrders30d: number
  lowStockCount: number
}

// ADM-11 — reporting period.
export const ReportPeriodSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime()
})
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>

// ADM-06 — admin user management.
export const CreateAdminUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  roleId: z.uuid()
})
export type CreateAdminUser = z.infer<typeof CreateAdminUserSchema>

export const AdminUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  roleId: z.uuid(),
  roleName: z.string(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime().nullable().optional()
})
export type AdminUser = z.infer<typeof AdminUserSchema>
