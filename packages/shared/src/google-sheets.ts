import { z } from 'zod'

// Google Sheets integration — admin-facing DTOs. See the GoogleSheet/
// ProductGoogleSheet/GoogleSheetOrderRow Prisma models for the full data
// model and routing-rule rationale (appliesToAllProducts vs explicit
// per-product mapping).

// Admins paste the sheet's full URL — this pulls the id segment out of it
// (docs.google.com/spreadsheets/d/{id}/edit#gid=0) so they never have to dig
// the raw id out by hand. A bare id (no slashes) passes through unchanged.
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : trimmed
}

export const CreateGoogleSheetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Accepts either a raw spreadsheet id or a full sheet URL — normalized by
  // extractSpreadsheetId() server-side before storage.
  spreadsheetUrl: z.string().trim().min(1).max(500),
  sheetName: z.string().trim().min(1).max(100).default('Orders'),
  appliesToAllProducts: z.boolean().default(false),
  enabled: z.boolean().default(true),
  // Only meaningful when appliesToAllProducts is false — the product ids
  // this sheet should receive orders for. Ignored (but harmless) otherwise.
  productIds: z.array(z.uuid()).default([])
})
export type CreateGoogleSheet = z.infer<typeof CreateGoogleSheetSchema>

export const UpdateGoogleSheetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  spreadsheetUrl: z.string().trim().min(1).max(500).optional(),
  sheetName: z.string().trim().min(1).max(100).optional(),
  appliesToAllProducts: z.boolean().optional(),
  enabled: z.boolean().optional(),
  // Omitted = leave the current product mapping alone; an array (including
  // empty) replaces it wholesale — same "omit vs explicit value" contract
  // used elsewhere in this codebase (e.g. AppsService's accessToken merge).
  productIds: z.array(z.uuid()).optional()
})
export type UpdateGoogleSheet = z.infer<typeof UpdateGoogleSheetSchema>

// What the admin UI actually renders — one row per connected sheet, with
// enough product info to label the mapping (not just raw ids).
export interface GoogleSheetView {
  id: string
  name: string
  spreadsheetId: string
  sheetUrl: string
  sheetName: string
  appliesToAllProducts: boolean
  enabled: boolean
  products: { id: string; name: string }[]
  createdAt: string
  updatedAt: string
}

// Result of the admin "test connection" action — appends a real test row (or
// just verifies the header row can be written, if the sheet is otherwise
// empty) so the admin gets immediate feedback that the service account
// actually has edit access, without waiting for a real order.
export interface TestGoogleSheetResult {
  ok: boolean
  message: string
}
