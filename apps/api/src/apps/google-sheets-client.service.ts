import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { google, sheets_v4 } from 'googleapis'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.validation'

// The fixed column layout every connected sheet gets — same order the
// Google Sheets app was built for (see the feature's original request):
// date/time, order id (needed internally to target a row for a later status
// update, also just useful for staff), customer, what was bought, pricing
// breakdown, and status. New columns would be a breaking change for anyone
// already relying on the layout, so this is deliberately treated as a fixed
// contract, not something to casually extend.
export const GOOGLE_SHEET_HEADER_ROW = [
  'Date & Time',
  'Order ID',
  'Client Name',
  'Client Phone',
  'Product',
  'Variant',
  'Quantity',
  'Offer',
  'Price',
  'Shipping Price',
  'Total Price',
  'Status'
]
// 1-indexed column letter for Status — the only cell a later transition
// needs to touch. Keep in sync with GOOGLE_SHEET_HEADER_ROW's last entry.
export const GOOGLE_SHEET_STATUS_COLUMN = 'L'

function columnLetterFromRange(updatedRange: string): { sheetName: string; row: number } | null {
  // updatedRange looks like "Orders!A5:L5" (or "'My Sheet'!A5:L5" when the
  // tab name has spaces) — pull the numeric row out of it rather than
  // trusting any row-count math, since Sheets is the one source of truth for
  // where it actually put the row.
  const match = updatedRange.match(/^'?([^'!]+)'?!\$?[A-Z]+\$?(\d+)/)
  if (!match) return null
  return { sheetName: match[1], row: Number(match[2]) }
}

@Injectable()
export class GoogleSheetsClientService {
  private readonly logger = new Logger(GoogleSheetsClientService.name)

  constructor(private readonly config: ConfigService<Env, true>) {}

  // A single global service account authenticates every connected sheet —
  // there's one Amalice backend, not one per store, so unlike the pixel
  // apps' per-store access tokens this credential is env-level (mirrors
  // GEMINI_API_KEY's "optional, feature degrades to a clear error" pattern).
  // The admin shares each target spreadsheet with this account's email like
  // they would with any collaborator.
  isConfigured(): boolean {
    return !!this.config.get('GOOGLE_SHEETS_CLIENT_EMAIL', { infer: true }) && !!this.config.get('GOOGLE_SHEETS_PRIVATE_KEY', { infer: true })
  }

  private getClient(): sheets_v4.Sheets {
    const clientEmail = this.config.get('GOOGLE_SHEETS_CLIENT_EMAIL', { infer: true })
    const privateKeyRaw = this.config.get('GOOGLE_SHEETS_PRIVATE_KEY', { infer: true })
    if (!clientEmail || !privateKeyRaw) {
      throw new BadGatewayException('Google Sheets isn\'t configured (missing service account credentials).')
    }
    // Env files can't hold real newlines in a single-line value — the
    // private key is stored with literal "\n" escapes and unescaped here.
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
    return google.sheets({ version: 'v4', auth })
  }

  // Writes the fixed header row if (and only if) row 1 is currently empty —
  // safe to call before every append rather than tracking "have we
  // initialized this sheet" state ourselves.
  async ensureHeaderRow(spreadsheetId: string, sheetName: string): Promise<void> {
    const sheets = this.getClient()
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:L1`
      })
      if (existing.data.values?.length) return
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [GOOGLE_SHEET_HEADER_ROW] }
      })
    } catch (error) {
      throw this.wrapError(error, 'write the header row')
    }
  }

  // Appends one row, returns the 1-indexed row number Sheets actually put it
  // at — needed so a later status update can target the exact cell instead
  // of re-scanning the sheet.
  async appendRow(spreadsheetId: string, sheetName: string, values: string[]): Promise<number> {
    const sheets = this.getClient()
    try {
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] }
      })
      const updatedRange = res.data.updates?.updatedRange
      const parsed = updatedRange ? columnLetterFromRange(updatedRange) : null
      if (!parsed) throw new Error(`Unexpected response from Sheets append (no updatedRange): ${JSON.stringify(res.data)}`)
      return parsed.row
    } catch (error) {
      throw this.wrapError(error, 'append a row')
    }
  }

  async updateStatusCell(spreadsheetId: string, sheetName: string, rowNumber: number, statusLabel: string): Promise<void> {
    const sheets = this.getClient()
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${GOOGLE_SHEET_STATUS_COLUMN}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[statusLabel]] }
      })
    } catch (error) {
      throw this.wrapError(error, 'update the status cell')
    }
  }

  // Admin "test connection" action — confirms the service account can
  // actually read/write the sheet (most common failure: the admin forgot to
  // share it with the service account's email) and leaves the header row in
  // place as visible proof it worked.
  async testConnection(spreadsheetId: string, sheetName: string): Promise<{ title: string }> {
    const sheets = this.getClient()
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId })
      await this.ensureHeaderRow(spreadsheetId, sheetName)
      return { title: meta.data.properties?.title ?? spreadsheetId }
    } catch (error) {
      throw this.wrapError(error, 'connect to the spreadsheet')
    }
  }

  private wrapError(error: unknown, action: string): BadGatewayException {
    const message = error instanceof Error ? error.message : String(error)
    this.logger.warn(`Google Sheets: failed to ${action}: ${message}`)
    return new BadGatewayException(
      `Couldn't ${action} — check the spreadsheet id/tab name and that it's shared with the service account. (${message})`
    )
  }
}
