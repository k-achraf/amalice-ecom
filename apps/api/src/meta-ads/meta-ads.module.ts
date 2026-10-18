import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module'
import { MetaAdsController } from './meta-ads.controller'
import { MetaAdsService } from './meta-ads.service'
import { MetaGraphService } from './meta-graph.service'
import { MetaCredentialsService } from './meta-credentials.service'

@Module({
  imports: [CommonModule],
  controllers: [MetaAdsController],
  providers: [MetaAdsService, MetaGraphService, MetaCredentialsService],
  exports: [MetaAdsService]
})
export class MetaAdsModule {}
