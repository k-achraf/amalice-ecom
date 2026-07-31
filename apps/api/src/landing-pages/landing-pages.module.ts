import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { LandingPagesController } from './landing-pages.controller'
import { LandingPagesService } from './landing-pages.service'
import { LandingPagesProcessor } from './landing-pages.processor'
import { GeminiService } from './gemini.service'
import { PollinationsService } from './pollinations.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [BullModule.registerQueue({ name: 'landing-pages' }), CommonModule],
  controllers: [LandingPagesController],
  providers: [LandingPagesService, LandingPagesProcessor, GeminiService, PollinationsService]
})
export class LandingPagesModule {}
