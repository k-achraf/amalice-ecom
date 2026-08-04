import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common'
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

  // The URL shown in Settings → Shipping Companies (see
  // ShippingCompaniesService.toView's webhookUrl) — :shippingCompanyId
  // scopes the request to the specific ShippingCompany row whose secret
  // verifies it, matching what an admin configures in DHD's own dashboard.
  @Post('dhd/:shippingCompanyId')
  async receiveDhdWebhook(@Param('shippingCompanyId') shippingCompanyId: string, @Body() body: unknown, @Headers('signature') signature: string | undefined, @Req() req: RawBodyRequest<Request>) {
    // Pass every header name along purely for diagnostics — if DHD's actual
    // delivery sends the signature under a different header name than
    // their docs say (or a proxy strips/renames it), this is what proves
    // it rather than leaving "signature" silently undefined with no trace.
    return this.dhdWebhook.handle(shippingCompanyId, req.rawBody, signature, body, Object.keys(req.headers))
  }
}
