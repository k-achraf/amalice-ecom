import { Module } from '@nestjs/common'
import { StoreSettingsController } from './store-settings.controller'
import { StoreSettingsService } from './store-settings.service'
import { CommonModule } from '../common/common.module'
import { LandingPagesModule } from '../landing-pages/landing-pages.module'

// LandingPagesModule is imported for its exported GeminiService (logo → font
// suggestion in the brand identity analysis).
@Module({
  imports: [CommonModule, LandingPagesModule],
  controllers: [StoreSettingsController],
  providers: [StoreSettingsService]
})
export class StoreSettingsModule {}
