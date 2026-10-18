import { Injectable } from '@nestjs/common'
import type { ReportSettingsView, UpdateReportSettings } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import type { ReportSettings } from '../generated/prisma/client'

@Injectable()
export class ReportSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  // The row (with the real bot token) — server-side use only.
  async get(): Promise<ReportSettings> {
    return this.prisma.reportSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } })
  }

  toView(row: ReportSettings): ReportSettingsView {
    return {
      enabled: row.enabled,
      telegramConfigured: !!row.telegramBotToken && !!row.telegramChatId,
      telegramChatId: row.telegramChatId,
      dailyReportHour: row.dailyReportHour,
      maxCostPerOrderDzd: row.maxCostPerOrderDzd,
      returnRateAlertPct: row.returnRateAlertPct,
      returnRateMinOrders: row.returnRateMinOrders,
      carrierStaleHours: row.carrierStaleHours
    }
  }

  async view(): Promise<ReportSettingsView> {
    return this.toView(await this.get())
  }

  async update(input: UpdateReportSettings, actor: AuditActor): Promise<ReportSettingsView> {
    const { telegramBotToken, ...rest } = input
    const data = {
      ...rest,
      telegramChatId: rest.telegramChatId || null,
      ...(telegramBotToken !== undefined && { telegramBotToken: telegramBotToken || null })
    }
    const row = await this.prisma.reportSettings.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...data } })
    await this.audit.log({ actor, action: 'Update', entity: 'ReportSettings', entityId: 'singleton', metadata: { ...rest, tokenChanged: telegramBotToken !== undefined } })
    return this.toView(row)
  }
}
