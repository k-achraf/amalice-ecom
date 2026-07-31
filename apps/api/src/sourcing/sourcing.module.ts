import { Module } from '@nestjs/common'
import { WholesalersController } from './wholesalers.controller'
import { WholesalersService } from './wholesalers.service'
import { SourcedProductsController } from './sourced-products.controller'
import { SourcedProductsService } from './sourced-products.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [WholesalersController, SourcedProductsController],
  providers: [WholesalersService, SourcedProductsService]
})
export class SourcingModule {}
