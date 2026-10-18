import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { AddressNormalizerService } from './address-normalizer.service'
import { AiToolsService } from './ai-tools.service'
import { AiAssistantService } from './ai-assistant.service'
import { AiInsightService } from './ai-insight.service'
import { AiSettingsService } from './ai-settings.service'
import { CommonModule } from '../common/common.module'
import { AiController } from './ai.controller'
import { MetaAdsModule } from '../meta-ads/meta-ads.module'

// Global so feature modules (orders, reports, call center…) can inject
// AiService without importing this module each time.
@Global()
@Module({
  imports: [MetaAdsModule, CommonModule],
  controllers: [AiController],
  providers: [AiService, AiSettingsService, AddressNormalizerService, AiToolsService, AiAssistantService, AiInsightService],
  exports: [AiService, AiSettingsService, AddressNormalizerService, AiInsightService]
})
export class AiModule {}
