import { Module } from '@nestjs/common'
import { SourcedProductsController } from './sourced-products.controller'
import { SourcedProductsService } from './sourced-products.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [SourcedProductsController],
  providers: [SourcedProductsService]
})
export class SourcingModule {}
