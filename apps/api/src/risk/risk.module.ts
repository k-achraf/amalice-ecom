import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module'
import { RiskService } from './risk.service'

@Module({
  imports: [CommonModule],
  providers: [RiskService],
  exports: [RiskService]
})
export class RiskModule {}
