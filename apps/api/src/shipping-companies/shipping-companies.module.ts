import { Module } from '@nestjs/common'
import { ShippingCompaniesController } from './shipping-companies.controller'
import { ShippingCompaniesService } from './shipping-companies.service'
import { DhdApiService } from './dhd-api.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [ShippingCompaniesController],
  providers: [ShippingCompaniesService, DhdApiService],
  exports: [ShippingCompaniesService, DhdApiService]
})
export class ShippingCompaniesModule {}
