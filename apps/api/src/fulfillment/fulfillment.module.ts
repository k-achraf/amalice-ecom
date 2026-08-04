import { Module } from '@nestjs/common'
import { FulfillmentController } from './fulfillment.controller'
import { WebhooksController } from './webhooks.controller'
import { FulfillmentService } from './fulfillment.service'
import { DhdWebhookService } from './dhd-webhook.service'
import { MockCourierProvider } from './mock-courier.provider'
import { DhdCourierProvider } from './dhd-courier.provider'
import { COURIER_PROVIDER } from './courier-provider.interface'
import { CommonModule } from '../common/common.module'
import { ShippingCompaniesModule } from '../shipping-companies/shipping-companies.module'
import { AppsModule } from '../apps/apps.module'

// COU-01/COU-02 — the COURIER_PROVIDER binding is the one line that changes
// to go from mock to real: this now binds DhdCourierProvider, which resolves
// the SPECIFIC shipping company an order was explicitly assigned
// (FulfillmentService.assignShippingCompany) — never a "default" company —
// and talks to the real DHD API with that account's credentials.
// MockCourierProvider stays registered directly (not via the COURIER_PROVIDER
// token) purely so the dev-only /admin/fulfillment/mock-status route still
// works for local testing without a real DHD account.
@Module({
  imports: [CommonModule, ShippingCompaniesModule, AppsModule],
  controllers: [FulfillmentController, WebhooksController],
  providers: [
    FulfillmentService,
    DhdWebhookService,
    MockCourierProvider, // dev-only mock-status route — see comment above
    DhdCourierProvider,
    { provide: COURIER_PROVIDER, useClass: DhdCourierProvider }
  ]
})
export class FulfillmentModule {}
