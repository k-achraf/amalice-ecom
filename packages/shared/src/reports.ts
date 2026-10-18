import { z } from 'zod'

// Admin view of the daily-report / alert settings. The Telegram bot token is
// write-only: the API returns only whether one is set.
export const ReportSettingsViewSchema = z.object({
  enabled: z.boolean(),
  telegramConfigured: z.boolean(),
  telegramChatId: z.string().nullable(),
  dailyReportHour: z.number().int().min(0).max(23),
  maxCostPerOrderDzd: z.number().int().positive().nullable(),
  returnRateAlertPct: z.number().int().min(1).max(100),
  returnRateMinOrders: z.number().int().min(1).max(1000),
  carrierStaleHours: z.number().int().min(0).max(720)
})
export type ReportSettingsView = z.infer<typeof ReportSettingsViewSchema>

export const UpdateReportSettingsSchema = z.object({
  enabled: z.boolean(),
  // Omit (or send undefined) to keep the stored token; empty string clears it.
  telegramBotToken: z.string().trim().max(200).optional(),
  telegramChatId: z.string().trim().max(100).nullable(),
  dailyReportHour: z.number().int().min(0).max(23),
  maxCostPerOrderDzd: z.number().int().positive().nullable(),
  returnRateAlertPct: z.number().int().min(1).max(100),
  returnRateMinOrders: z.number().int().min(1).max(1000),
  carrierStaleHours: z.number().int().min(0).max(720)
})
export type UpdateReportSettings = z.infer<typeof UpdateReportSettingsSchema>
