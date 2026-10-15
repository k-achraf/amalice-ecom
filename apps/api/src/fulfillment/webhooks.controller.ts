import { Body, Controller, Headers, NotFoundException, Param, Post, Req } from '@nestjs/common'
import { providerFromWebhookSlug } from '@amalice/shared'
import { ApiTags } from '@nestjs/swagger'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { DhdWebhookService } from './dhd-webhook.service'

// Public, unauthenticated inbound webhook endpoints for courier platforms —
// authenticity comes from each provider's own HMAC signature (see
// DhdWebhookService.verifySignature), not a JWT/session, since the caller
// is DHD's platform, not a logged-in admin. Deliberately its own controller
// (not FulfillmentController) since these routes carry none of that
// controller's JwtAuthGuard/RolesGuard baggage.
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly dhdWebhook: DhdWebhookService) {}

  // The URL shown in Settings → Shipping Companies (see ShippingCompaniesService.toView's webhookUrl):
  // POST /webhooks/<provider slug>/:shippingCompanyId. :shippingCompanyId scopes the request to the specific
  // ShippingCompany row whose secret verifies it, matching what an admin configures in the courier's own
  // dashboard. DHD and the Ecotrack-hosted couriers all send the same payload, so one handler serves every slug.
  @Post(':providerSlug/:shippingCompanyId')
  async receiveWebhook(
    @Param('providerSlug') providerSlug: string,
    @Param('shippingCompanyId') shippingCompanyId: string,
    @Body() body: unknown,
    @Headers('signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>
  ) {
    const provider = providerFromWebhookSlug(providerSlug)
    if (!provider) throw new NotFoundException('Unknown webhook endpoint')
    // Pass the full headers object (not just names) — the service persists every request's raw headers/body to
    // CourierWebhookLog unconditionally, so a rejected delivery (401/400/404) is still fully visible in the
    // admin's webhook log, not just successful ones.
    return this.dhdWebhook.handle(provider, shippingCompanyId, req.rawBody, signature, body, req.headers)
  }
}
