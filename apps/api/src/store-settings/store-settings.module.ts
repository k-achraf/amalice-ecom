import { Module } from '@nestjs/common'
import { StoreSettingsController } from './store-settings.controller'
import { StoreSettingsService } from './store-settings.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [StoreSettingsController],
  providers: [StoreSettingsService]
})
export class StoreSettingsModule {}
