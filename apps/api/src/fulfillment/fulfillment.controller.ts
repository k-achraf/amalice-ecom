import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { FulfillmentService } from './fulfillment.service'
import { MockCourierProvider } from './mock-courier.provider'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

@ApiTags('fulfillment')
@Controller()
export class FulfillmentController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly mockCourier: MockCourierProvider
  ) {}

  @Get('fulfillment/health')
  health() {
    return { module: 'fulfillment', status: 'ok' }
  }

  // COU-03 — dispatch a packed order to the courier (creates the shipment).
  @Post('admin/fulfillment/orders/:id/dispatch')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  dispatch(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.createShipmentForOrder(id, actor)
  }

  // COU-04 — inbound webhook. In production this verifies the courier's
  // signature first (adapter-specific). With the mock provider, the admin
  // fulfillment screen (ADM-13) drives status changes through the dev-only
  // /admin/fulfillment/mock-status route below instead — no real courier to
  // send a webhook in dev. This route is the production-ready seam.
  @Post('fulfillment/webhook')
  webhook(@Body() body: unknown) {
    // A real adapter's parseWebhook would run here, after signature verify.
    // With the mock, we accept the already-normalized shape directly.
    const payload = this.mockCourier.parseWebhook(body)
    return this.fulfillment.applyCourierStatus(payload.trackingReference, payload.normalizedStatus)
  }

  // DEV-ONLY — simulates a courier status update for local dev/testing with
  // the mock provider. Not a production route; the mock provider is dev-only.
  @Post('admin/fulfillment/mock-status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  mockStatus(@Body() body: { trackingReference: string; normalizedStatus: Parameters<MockCourierProvider['markStatus']>[1] }) {
    this.mockCourier.markStatus(body.trackingReference, body.normalizedStatus)
    return this.fulfillment.applyCourierStatus(body.trackingReference, body.normalizedStatus)
  }
}
