import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { CheckoutSchema, LeadOrderSchema, AbandonedLeadOrderSchema, TrackOrderQuerySchema, AcceptOrderUpsellSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { OrdersService, type OrderRequestContext } from './orders.service'

class CheckoutDto extends createZodDto(CheckoutSchema) {}
class LeadOrderDto extends createZodDto(LeadOrderSchema) {}
class AbandonedLeadOrderDto extends createZodDto(AbandonedLeadOrderSchema) {}
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

  // Public social-proof feed (real orders, never fabricated copy) — see
  // OrdersService.getRecentActivity. Cheap, read-only, no PII in the
  // response (customerName is reduced to one letter server-side) — same
  // @SkipThrottle rationale as /settings: a storefront "recent orders"
  // ticker fetches this once per page load.
  @Get('recent-activity')
  @SkipThrottle()
  async recentActivity(@Query('limit') limit?: string) {
    const items = await this.orders.getRecentActivity(limit ? Number(limit) : undefined)
    return { items }
  }

  // Tighter than the sibling endpoints below (20/5min) — a real customer
  // only ever submits ONE checkout per visit, so this budget is generous
  // for shared-NAT households/offices while still capping a scripted burst.
  // The main anti-abuse work happens in OrdersService itself (idempotency
  // key, form-pace check, duplicate-order flagging) — this is just the
  // blunt per-IP backstop.
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  create(@Body() body: CheckoutDto, @Req() req: Request) {
    return this.orders.createOrder(body, requestContext(req))
  }

  // Lead-form order — creates it in PendingCallCenter directly. Used when
  // displayCart=false: the customer fills name/phone/wilaya/commune on the PDP.
  @Post('lead')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  createLead(@Body() body: LeadOrderDto, @Req() req: Request) {
    return this.orders.createLeadOrder(body, requestContext(req))
  }

  // Fired by the storefront lead form after the customer goes idle past the
  // store's configured delay without submitting (see
  // AbandonedLeadOrderSchema). Rate-limited like the other public,
  // unauthenticated write endpoints below — a client-side timer firing
  // repeatedly from a stuck tab shouldn't be able to hammer this.
  @Post('abandoned')
  @Throttle({ default: { limit: 20, ttl: 5 * 60 * 1000 } })
  createAbandoned(@Body() body: AbandonedLeadOrderDto) {
    return this.orders.createAbandonedOrder(body)
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
