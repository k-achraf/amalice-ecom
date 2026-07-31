import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CheckoutSchema, LeadOrderSchema, TrackOrderQuerySchema, AcceptOrderUpsellSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { OrdersService, type OrderRequestContext } from './orders.service'

class CheckoutDto extends createZodDto(CheckoutSchema) {}
class LeadOrderDto extends createZodDto(LeadOrderSchema) {}
class TrackOrderQueryDto extends createZodDto(TrackOrderQuerySchema) {}
// Phone is the same shared-secret pattern as track — reused here for both
// history lookup and the query DTO's validation (E.164 shape).
class HistoryQueryDto extends createZodDto(TrackOrderQuerySchema) {}
class AcceptOrderUpsellDto extends createZodDto(AcceptOrderUpsellSchema) {}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('health')
  health() {
    return { module: 'orders', status: 'ok' }
  }

  @Post()
  create(@Body() body: CheckoutDto, @Req() req: Request) {
    return this.orders.createOrder(body, requestContext(req))
  }

  // Lead-form order — creates it in PendingCallCenter directly. Used when
  // displayCart=false: the customer fills name/phone/wilaya/commune on the PDP.
  @Post('lead')
  createLead(@Body() body: LeadOrderDto, @Req() req: Request) {
    return this.orders.createLeadOrder(body, requestContext(req))
  }

  // Order id + phone together act as a shared secret — public and
  // unauthenticated by design (no account system exists), but rate-limited
  // (SEC-06) since the id alone is a guessable-enough UUID to deter
  // brute-forcing phone numbers against it without a tight budget.
  @Get(':id/track')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  track(@Param('id') id: string, @Query() query: TrackOrderQueryDto) {
    return this.orders.trackOrder(id, query.phone)
  }

  // Phone is the shared secret (same pattern as :id/track) — no OTP/account
  // system. Rate-limited for the same reason track is: a phone number alone
  // is guessable enough to deserve a tight budget.
  @Get('history')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  history(@Query() query: HistoryQueryDto) {
    return this.orders.getHistory(query.phone)
  }

  // Upsells system's storefront post-checkout page — same phone-shared-
  // secret pattern and throttle budget as :id/track.
  @Get(':id/upsell')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  upsell(@Param('id') id: string, @Query() query: TrackOrderQueryDto) {
    return this.orders.getUpsellForOrder(id, query.phone)
  }

  @Post(':id/upsell/accept')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  acceptUpsell(@Param('id') id: string, @Body() body: AcceptOrderUpsellDto) {
    return this.orders.acceptUpsell(id, body)
  }
}

// Best-effort IP/user-agent extraction for the Meta Conversions API's match
// quality fields — not security-sensitive (unlike auth), so no need for a
// `trust proxy` setup here beyond what Express's default req.ip gives us.
function requestContext(req: Request): OrderRequestContext {
  return { ip: req.ip, userAgent: req.headers['user-agent'] }
}
