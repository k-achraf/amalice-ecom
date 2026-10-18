import { Module } from '@nestjs/common'
import { FunnelsController } from './funnels.controller'
import { FunnelsService } from './funnels.service'
import { FunnelsAiService } from './funnels-ai.service'
import { LandingPagesModule } from '../landing-pages/landing-pages.module'
import { FunnelsStatsService } from './funnels-stats.service'
import { FunnelsPublicController } from './funnels-public.controller'
import { FunnelsPublicService } from './funnels-public.service'
import { CommonModule } from '../common/common.module'
import { OrdersModule } from '../orders/orders.module'
import { OrderItemsModule } from '../order-items/order-items.module'

@Module({
  imports: [CommonModule, OrdersModule, OrderItemsModule, LandingPagesModule],
  controllers: [FunnelsController, FunnelsPublicController],
  providers: [FunnelsService, FunnelsAiService, FunnelsStatsService, FunnelsPublicService]
})
export class FunnelsModule {}
