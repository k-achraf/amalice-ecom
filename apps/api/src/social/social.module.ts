import { Module } from '@nestjs/common'
import { MetaAdsModule } from '../meta-ads/meta-ads.module'
import { SocialController } from './social.controller'
import { SocialService } from './social.service'

@Module({
  imports: [MetaAdsModule],
  controllers: [SocialController],
  providers: [SocialService]
})
export class SocialModule {}
