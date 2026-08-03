import { Body, Controller, Get, Header, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { createZodDto } from 'nestjs-zod'
import { RequestPickupSchema, UpdateShipmentSchema, BulkDispatchSchema, ValidateOrderReturnsSchema, AssignShippingCompanySchema, DispatchManualSchema } from '@amalice/shared'
import { FulfillmentService } from './fulfillment.service'
import { MockCourierProvider } from './mock-courier.provider'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class RequestPickupDto extends createZodDto(RequestPickupSchema) {}
class UpdateShipmentDto extends createZodDto(UpdateShipmentSchema) {}
class BulkDispatchDto extends createZodDto(BulkDispatchSchema) {}
class ValidateOrderReturnsDto extends createZodDto(ValidateOrderReturnsSchema) {}
class AssignShippingCompanyDto extends createZodDto(AssignShippingCompanySchema) {}
class DispatchManualDto extends createZodDto(DispatchManualSchema) {}

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

  // Assign a shipping company to an order — required before dispatch.
  // Dispatch deliberately never falls back to a "default" company.
  @Post('admin/fulfillment/orders/:id/assign-company')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  assignCompany(@Param('id') id: string, @Body() body: AssignShippingCompanyDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.assignShippingCompany(id, body.shippingCompanyId, actor)
  }

  // Assign an order to manual (in-house) delivery — no shipping company.
  @Post('admin/fulfillment/orders/:id/assign-manual')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  assignManual(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.assignManual(id, actor)
  }

  // COU-03 / "Ajouter une commande" — dispatch a packed order to whichever
  // shipping company it was explicitly assigned (creates the shipment,
  // order -> HandedToCourier). Requires assign-company first.
  @Post('admin/fulfillment/orders/:id/dispatch')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  dispatch(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.createShipmentForOrder(id, actor)
  }

  // Manual dispatch — no shipping company API call, tracking reference
  // entered by hand. Works for an order assigned to manual (in-house)
  // delivery, or one assigned to a shipping company that staff arranged
  // directly with that company instead of through our API integration.
  // Requires assign-company or assign-manual first (never Unassigned).
  @Post('admin/fulfillment/orders/:id/dispatch-manual')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  dispatchManual(@Param('id') id: string, @Body() body: DispatchManualDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.dispatchManual(id, body.trackingReference, actor)
  }

  // "Ajouter plusieurs commandes" — dispatch several Packed orders at once,
  // all pre-assigned to the same shipping company.
  @Post('admin/fulfillment/orders/bulk-dispatch')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  bulkDispatch(@Body() body: BulkDispatchDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.bulkDispatch(body.orderIds, body.shippingCompanyId, actor)
  }

  // "Expedier une commande" — confirm/dispatch an already-created DHD
  // shipment for actual pickup, separate from creating it.
  @Post('admin/fulfillment/orders/:id/request-pickup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  requestPickup(@Param('id') id: string, @Body() body: RequestPickupDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.requestPickup(id, body.askCollection, actor)
  }

  // "Supprimer une commande" — cancel the shipment with DHD.
  @Post('admin/fulfillment/orders/:id/cancel-shipment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  cancelShipment(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.cancelShipmentForOrder(id, actor)
  }

  // "Modifier une commande" — edit address/contact/remark fields on an
  // already-created DHD shipment.
  @Post('admin/fulfillment/orders/:id/shipment')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  updateShipment(@Param('id') id: string, @Body() body: UpdateShipmentDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.updateShipmentForOrder(id, body, actor)
  }

  // "Télécharger l'étiquette" — streams the label PDF straight through.
  @Get('admin/fulfillment/orders/:id/label')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  @Header('Content-Disposition', 'inline; filename="label.pdf"')
  async downloadLabel(@Param('id') id: string, @Res() res: Response) {
    const { data, contentType } = await this.fulfillment.getShipmentLabel(id)
    res.setHeader('Content-Type', contentType)
    res.send(data)
  }

  // "Valider la réception des retours" — confirm physical receipt of
  // returned parcels, by order id.
  @Post('admin/fulfillment/orders/validate-returns')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  validateReturns(@Body() body: ValidateOrderReturnsDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.fulfillment.validateReturns(body.orderIds, actor)
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
