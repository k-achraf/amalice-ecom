import { Module } from '@nestjs/common'
import { OrderItemsService } from './order-items.service'
import { CommonModule } from '../common/common.module'

// Small standalone module so its shared "add item to order" mutation core
// (see OrderItemsService's comment) can be imported by both AdminModule
// (call-center/admin add-item) and OrdersModule (public upsell accept)
// without either depending on the other.
@Module({
  imports: [CommonModule],
  providers: [OrderItemsService],
  exports: [OrderItemsService]
})
export class OrderItemsModule {}
