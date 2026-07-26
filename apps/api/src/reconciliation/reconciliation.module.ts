import { Module } from '@nestjs/common'
import { ReconciliationController } from './reconciliation.controller'
import { ReconciliationService } from './reconciliation.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService]
})
export class ReconciliationModule {}
