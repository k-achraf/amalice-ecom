import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { IdentityModule } from '../identity/identity.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AppsModule } from '../apps/apps.module'
import { OrderItemsModule } from '../order-items/order-items.module'

@Module({
  imports: [IdentityModule, NotificationsModule, AppsModule, OrderItemsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
