import { Module } from '@nestjs/common'
import { AppsController } from './apps.controller'
import { AppsService } from './apps.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [AppsController],
  providers: [AppsService]
})
export class AppsModule {}
