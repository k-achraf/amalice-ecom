import { Global, Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { UploadController } from './upload.controller'
import { AdminOrdersService } from './admin-orders.service'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminUsersService } from './admin-users.service'
import { AdminStatsService } from './admin-stats.service'
import { AdminProductManagementService } from './admin-product-management.service'
import { AdminShippingService } from './admin-shipping.service'
import { CommonModule } from '../common/common.module'
import { OrderItemsModule } from '../order-items/order-items.module'
import { AppsModule } from '../apps/apps.module'

@Global()
@Module({
  imports: [CommonModule, OrderItemsModule, AppsModule],
  controllers: [AdminController, UploadController],
  providers: [AdminOrdersService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService, AdminShippingService],
  exports: [AdminOrdersService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService, AdminShippingService]
})
export class AdminModule {}
