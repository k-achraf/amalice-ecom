import { Module } from '@nestjs/common'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { IdentityModule } from '../identity/identity.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
