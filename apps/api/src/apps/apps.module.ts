import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AppsController } from './apps.controller'
import { AppsService } from './apps.service'
import { MetaConversionsApiService } from './meta-conversions-api.service'
import { TikTokEventsApiService } from './tiktok-events-api.service'
import { GoogleSheetsClientService } from './google-sheets-client.service'
import { GoogleSheetsService } from './google-sheets.service'
import { GoogleSheetsSyncProcessor } from './google-sheets-sync.processor'
import { GoogleSheetsController } from './google-sheets.controller'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule, BullModule.registerQueue({ name: 'google-sheets-sync' })],
  controllers: [AppsController, GoogleSheetsController],
  providers: [AppsService, MetaConversionsApiService, TikTokEventsApiService, GoogleSheetsClientService, GoogleSheetsService, GoogleSheetsSyncProcessor],
  // Both pixel API services and GoogleSheetsService are exported so
  // OrdersModule/AdminModule can fire order events (purchase pixel events,
  // Sheets row push/status update) without duplicating this module's
  // plumbing.
  exports: [AppsService, MetaConversionsApiService, TikTokEventsApiService, GoogleSheetsService]
})
export class AppsModule {}
