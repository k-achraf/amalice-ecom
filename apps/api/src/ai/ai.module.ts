import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { AddressNormalizerService } from './address-normalizer.service'
import { AiToolsService } from './ai-tools.service'
import { AiAssistantService } from './ai-assistant.service'
import { AiInsightService } from './ai-insight.service'
import { AiController } from './ai.controller'
import { MetaAdsModule } from '../meta-ads/meta-ads.module'

// Global so feature modules (orders, reports, call center…) can inject
// AiService without importing this module each time.
@Global()
@Module({
  imports: [MetaAdsModule],
  controllers: [AiController],
  providers: [AiService, AddressNormalizerService, AiToolsService, AiAssistantService, AiInsightService],
  exports: [AiService, AddressNormalizerService, AiInsightService]
})
export class AiModule {}
