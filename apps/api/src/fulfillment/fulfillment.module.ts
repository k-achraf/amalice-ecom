import { Module } from '@nestjs/common'
import { FulfillmentController } from './fulfillment.controller'
import { FulfillmentService } from './fulfillment.service'
import { MockCourierProvider } from './mock-courier.provider'
import { DhdCourierProvider } from './dhd-courier.provider'
import { COURIER_PROVIDER } from './courier-provider.interface'
import { CommonModule } from '../common/common.module'
import { DhdApiService } from '../shipping-companies/dhd-api.service'

// COU-01/COU-02 — the COURIER_PROVIDER binding is the one line that changes
// to go from mock to real: this now binds DhdCourierProvider (which talks to
// the real DHD API, throwing a clear "not linked" error if Settings →
// Shipping Companies hasn't linked DHD yet) instead of MockCourierProvider.
// MockCourierProvider stays registered directly (not via the COURIER_PROVIDER
// token) purely so the dev-only /admin/fulfillment/mock-status route still
// works for local testing without a real DHD account.
@Module({
  imports: [CommonModule],
  controllers: [FulfillmentController],
  providers: [
    FulfillmentService,
    MockCourierProvider, // dev-only mock-status route — see comment above
    DhdCourierProvider,
    DhdApiService,
    { provide: COURIER_PROVIDER, useClass: DhdCourierProvider }
  ]
})
export class FulfillmentModule {}
