import { Global, Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { AddressNormalizerService } from './address-normalizer.service'
import { AiToolsService } from './ai-tools.service'
import { AiAssistantService } from './ai-assistant.service'
import { AiController } from './ai.controller'

// Global so feature modules (orders, reports, call center…) can inject
// AiService without importing this module each time.
@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, AddressNormalizerService, AiToolsService, AiAssistantService],
  exports: [AiService, AddressNormalizerService]
})
export class AiModule {}
