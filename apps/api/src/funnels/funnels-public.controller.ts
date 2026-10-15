import { Body, Controller, Get, Header, Param, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { AcceptFunnelOfferSchema, FunnelOrderSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { FunnelsPublicService } from './funnels-public.service'

class FunnelOrderDto extends createZodDto(FunnelOrderSchema) {}
class AcceptFunnelOfferDto extends createZodDto(AcceptFunnelOfferSchema) {}

// Public, unauthenticated: the funnels site and its visitors' browsers call these.
@ApiTags('funnels-public')
@Controller('public/funnels')
export class FunnelsPublicController {
  constructor(private readonly funnels: FunnelsPublicService) {}

  // Read by the funnels site's server (not by visitors), once per cache window per funnel.
  // Exempt from the global throttle for the same reason as GET /settings.
  @Get(':slug')
  @SkipThrottle()
  @Header('Cache-Control', 'public, max-age=15')
  get(@Param('slug') slug: string) {
    return this.funnels.get(slug)
  }

  // Same per-IP budget as POST /orders/lead: a real visitor submits once.
  @Post(':slug/orders')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  placeOrder(@Param('slug') slug: string, @Body() body: FunnelOrderDto, @Req() req: Request) {
    return this.funnels.placeOrder(slug, body, { ip: req.ip, userAgent: req.headers['user-agent'] })
  }

  @Post(':slug/orders/:orderId/offers/:stepId')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  acceptOffer(@Param('slug') slug: string, @Param('orderId') orderId: string, @Param('stepId') stepId: string, @Body() body: AcceptFunnelOfferDto) {
    return this.funnels.acceptOffer(slug, orderId, stepId, body)
  }
}
