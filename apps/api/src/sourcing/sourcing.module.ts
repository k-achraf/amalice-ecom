import { Module } from '@nestjs/common'
import { SourcedProductsController } from './sourced-products.controller'
import { SourcedProductsService } from './sourced-products.service'
import { SourcingAnalysisService } from './sourcing-analysis.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [SourcedProductsController],
  providers: [SourcedProductsService, SourcingAnalysisService]
})
export class SourcingModule {}
