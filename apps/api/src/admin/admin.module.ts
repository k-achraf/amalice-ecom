import { Global, Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { UploadController } from './upload.controller'
import { AdminOrdersService } from './admin-orders.service'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminUsersService } from './admin-users.service'
import { AdminStatsService } from './admin-stats.service'
import { AdminProductManagementService } from './admin-product-management.service'
import { CommonModule } from '../common/common.module'

@Global()
@Module({
  imports: [CommonModule],
  controllers: [AdminController, UploadController],
  providers: [AdminOrdersService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService],
  exports: [AdminOrdersService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService]
})
export class AdminModule {}
