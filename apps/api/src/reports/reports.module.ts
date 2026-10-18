import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AppsModule } from '../apps/apps.module'
import { MetaAdsModule } from '../meta-ads/meta-ads.module'
import { CommonModule } from '../common/common.module'
import { IdentityModule } from '../identity/identity.module'
import { DeliveryEventsService } from './delivery-events.service'
import { ReportSettingsService } from './report-settings.service'
import { ReportsController } from './reports.controller'
import { ReportsProcessor } from './reports.processor'
import { ReportsService } from './reports.service'
import { TelegramService } from './telegram.service'

@Module({
  imports: [CommonModule, IdentityModule, AppsModule, MetaAdsModule, BullModule.registerQueue({ name: 'reports' })],
  controllers: [ReportsController],
  providers: [TelegramService, ReportSettingsService, ReportsService, DeliveryEventsService, ReportsProcessor]
})
export class ReportsModule {}
