import { Module } from '@nestjs/common'
import { FulfillmentController } from './fulfillment.controller'
import { FulfillmentService } from './fulfillment.service'
import { MockCourierProvider } from './mock-courier.provider'
import { COURIER_PROVIDER } from './courier-provider.interface'
import { CommonModule } from '../common/common.module'

// COU-01 — the COURIER_PROVIDER binding is the one line that changes when a
// real courier adapter ships (COU-02): swap useClass from MockCourierProvider
// to the real adapter. Nothing else in the order/fulfillment flow changes.
@Module({
  imports: [CommonModule],
  controllers: [FulfillmentController],
  providers: [
    FulfillmentService,
    MockCourierProvider, // also provided directly so the controller can call markStatus (dev-only)
    { provide: COURIER_PROVIDER, useClass: MockCourierProvider }
  ]
})
export class FulfillmentModule {}
