import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { google, sheets_v4 } from 'googleapis'
import { ConfigService } from '@nestjs/config'
import { ORDER_STATE_LABELS, statesForStage } from '@amalice/shared'
import type { Env } from '../config/env.validation'

// The fixed column layout every connected sheet gets — same order the
// Google Sheets app was built for (see the feature's original request), now
// extended with shipping-assignment and per-stage status columns (a second
// request, after the original single "Status" column proved too coarse to
// tell call-center/fulfillment/delivery outcomes apart at a glance). New
// columns are still a breaking change for anyone relying on the old 12-col
// layout — ensureHeaderRow below detects and migrates a stale header rather
// than silently leaving old sheets on the old contract forever.
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
  'Sent to Shipping Company',
  'Shipping Company',
  'Call Center Status',
  'Fulfillment Status',
  'Delivery Status'
]

// 1-indexed column letters — keep in sync with GOOGLE_SHEET_HEADER_ROW above.
export const GOOGLE_SHEET_COLUMNS = {
  sentToShippingCompany: 'L',
  shippingCompany: 'M',
  callCenterStatus: 'N',
  fulfillmentStatus: 'O',
  deliveryStatus: 'P'
} as const
export type GoogleSheetStatusColumn = 'callCenterStatus' | 'fulfillmentStatus' | 'deliveryStatus'

// 0-indexed column numbers for the same cells, for Sheets API GridRange
// requests (data validation, formatting) — the API uses 0-indexed
// start/end-exclusive ranges, not the A1 letters used everywhere else here.
const COLUMN_INDEX: Record<keyof typeof GOOGLE_SHEET_COLUMNS, number> = {
  sentToShippingCompany: 11,
  shippingCompany: 12,
  callCenterStatus: 13,
  fulfillmentStatus: 14,
  deliveryStatus: 15
}

// Data-validation dropdowns only need to cover a generous but finite row
// range — Sheets doesn't support "the rest of the column" as a target for
// setDataValidation, and re-applying on every header check would be wasteful.
const VALIDATION_ROW_COUNT = 2000

const HEADER_BACKGROUND = { red: 0.114, green: 0.157, blue: 0.290 } // Stripe/Polaris-ish dark indigo, matches admin chrome
const HEADER_TEXT = { red: 1, green: 1, blue: 1 }

function columnLetterFromRange(updatedRange: string): { sheetName: string; row: number } | null {
  // updatedRange looks like "Orders!A5:P5" (or "'My Sheet'!A5:P5" when the
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

  // Resolves the tab name to the numeric grid id batchUpdate requests need
  // (formatting/data-validation calls take a GridRange keyed by sheetId, not
  // the tab title values.get/update use everywhere else in this file).
  private async getSheetId(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string): Promise<number> {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
    const match = meta.data.sheets?.find((s) => s.properties?.title === sheetName)
    if (match?.properties?.sheetId == null) {
      throw new Error(`No tab named "${sheetName}" found in this spreadsheet`)
    }
    return match.properties.sheetId
  }

  // Header background/bold-white-text + a frozen first row — the "some UI"
  // half of the header-row request, applied once whenever the header is
  // (re)written, not on every push (see ensureHeaderRow).
  private async applyHeaderFormatting(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetId: number): Promise<void> {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: GOOGLE_SHEET_HEADER_ROW.length },
              cell: {
                userEnteredFormat: {
                  backgroundColor: HEADER_BACKGROUND,
                  textFormat: { foregroundColor: HEADER_TEXT, bold: true },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
            }
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 32 },
              fields: 'pixelSize'
            }
          }
        ]
      }
    })
  }

  // One-of-list dropdowns for the select-style columns — "our system
  // states" per stage for the three status columns, Yes/No for the
  // dispatched flag, and the live shipping-company roster (plus "Delivery
  // man" for manual/in-house delivery) for the company column.
  private async applyDataValidation(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetId: number, shippingCompanyNames: string[]): Promise<void> {
    const oneOfList = (values: string[]) => ({ condition: { type: 'ONE_OF_LIST' as const, values: values.map((v) => ({ userEnteredValue: v })) }, strict: true, showCustomUi: true })
    const range = (columnIndex: number) => ({ sheetId, startRowIndex: 1, endRowIndex: VALIDATION_ROW_COUNT, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 })

    const callCenterLabels = statesForStage('CallCenter').map((s) => ORDER_STATE_LABELS[s])
    const fulfillmentLabels = statesForStage('Fulfillment').map((s) => ORDER_STATE_LABELS[s])
    const deliveryLabels = [...statesForStage('Shipping'), ...statesForStage('Finance'), ...statesForStage('Other')].map((s) => ORDER_STATE_LABELS[s])
    const companyLabels = ['—', 'Delivery man', ...shippingCompanyNames]

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { setDataValidation: { range: range(COLUMN_INDEX.sentToShippingCompany), rule: oneOfList(['Yes', 'No']) } },
          { setDataValidation: { range: range(COLUMN_INDEX.shippingCompany), rule: oneOfList(companyLabels) } },
          { setDataValidation: { range: range(COLUMN_INDEX.callCenterStatus), rule: oneOfList(callCenterLabels) } },
          { setDataValidation: { range: range(COLUMN_INDEX.fulfillmentStatus), rule: oneOfList(fulfillmentLabels) } },
          { setDataValidation: { range: range(COLUMN_INDEX.deliveryStatus), rule: oneOfList(deliveryLabels) } }
        ]
      }
    })
  }

  // Writes the fixed header row if row 1 doesn't already match it exactly —
  // covers both a brand-new tab (empty row 1) and migrating an
  // already-connected sheet from an older/shorter header onto the current
  // column contract. Formatting + dropdowns are (re)applied in the same
  // pass, since a header rewrite means the columns just changed shape.
  async ensureHeaderRow(spreadsheetId: string, sheetName: string, shippingCompanyNames: string[]): Promise<void> {
    const sheets = this.getClient()
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:P1`
      })
      const current = existing.data.values?.[0]
      if (current && current.length === GOOGLE_SHEET_HEADER_ROW.length && GOOGLE_SHEET_HEADER_ROW.every((h, i) => current[i] === h)) {
        return
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [GOOGLE_SHEET_HEADER_ROW] }
      })
      const sheetId = await this.getSheetId(sheets, spreadsheetId, sheetName)
      await this.applyHeaderFormatting(sheets, spreadsheetId, sheetId)
      await this.applyDataValidation(sheets, spreadsheetId, sheetId, shippingCompanyNames)
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

  // Updates one named cell in a row — used for both the per-stage status
  // columns and the shipping-assignment columns, whichever the caller names.
  async updateCell(spreadsheetId: string, sheetName: string, column: string, rowNumber: number, value: string): Promise<void> {
    const sheets = this.getClient()
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${column}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] }
      })
    } catch (error) {
      throw this.wrapError(error, `update cell ${column}${rowNumber}`)
    }
  }

  // Admin "test connection" action — confirms the service account can
  // actually read/write the sheet (most common failure: the admin forgot to
  // share it with the service account's email) and leaves the header row in
  // place as visible proof it worked.
  async testConnection(spreadsheetId: string, sheetName: string, shippingCompanyNames: string[]): Promise<{ title: string }> {
    const sheets = this.getClient()
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId })
      await this.ensureHeaderRow(spreadsheetId, sheetName, shippingCompanyNames)
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
