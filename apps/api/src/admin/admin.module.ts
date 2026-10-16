import { Global, Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { UploadController } from './upload.controller'
import { AdminOrdersService } from './admin-orders.service'
import { AdminCallCenterService } from './admin-call-center.service'
import { AdminDeleteService } from './admin-delete.service'
import { AdminOrderTimelineService } from './admin-order-timeline.service'
import { AdminDeliveriesService } from './admin-deliveries.service'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminUsersService } from './admin-users.service'
import { AdminStatsService } from './admin-stats.service'
import { AdminProductManagementService } from './admin-product-management.service'
import { AdminShippingService } from './admin-shipping.service'
import { CommonModule } from '../common/common.module'
import { OrderItemsModule } from '../order-items/order-items.module'
import { AppsModule } from '../apps/apps.module'
import { LandingPagesModule } from '../landing-pages/landing-pages.module'
import { ShippingCompaniesModule } from '../shipping-companies/shipping-companies.module'

@Global()
@Module({
  // LandingPagesModule is imported for its exported GeminiService — the
  // product editor's "generate with AI" content drafter (see
  // AdminProductManagementService.generateContent) reuses the same free
  // Gemini client the landing-page builder uses, rather than a second one.
  imports: [CommonModule, OrderItemsModule, AppsModule, LandingPagesModule, ShippingCompaniesModule],
  controllers: [AdminController, UploadController],
  providers: [AdminOrdersService, AdminCallCenterService, AdminDeleteService, AdminOrderTimelineService, AdminDeliveriesService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService, AdminShippingService],
  exports: [AdminOrdersService, AdminCallCenterService, AdminCatalogService, AdminUsersService, AdminStatsService, AdminProductManagementService, AdminShippingService]
})
export class AdminModule {}
