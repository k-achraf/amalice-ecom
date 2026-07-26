import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CheckoutSchema, ConfirmOrderSchema, LeadOrderSchema, TrackOrderQuerySchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { OrdersService } from './orders.service'
import { CustomerAuthGuard, type CustomerJwtPayload } from '../identity/otp/customer-auth.guard'

class CheckoutDto extends createZodDto(CheckoutSchema) {}
class ConfirmOrderDto extends createZodDto(ConfirmOrderSchema) {}
class LeadOrderDto extends createZodDto(LeadOrderSchema) {}
class TrackOrderQueryDto extends createZodDto(TrackOrderQuerySchema) {}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('health')
  health() {
    return { module: 'orders', status: 'ok' }
  }

  @Post()
  create(@Body() body: CheckoutDto) {
    return this.orders.createOrder(body)
  }

  // Lead-form order — no OTP, creates Confirmed directly. Used when
  // displayCart=false: the customer fills name/phone/wilaya/commune on the PDP.
  @Post('lead')
  createLead(@Body() body: LeadOrderDto) {
    return this.orders.createLeadOrder(body)
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() body: ConfirmOrderDto) {
    return this.orders.confirmOrder(id, body.code)
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

  @Get('history')
  @UseGuards(CustomerAuthGuard)
  history(@Req() req: Request & { customer: CustomerJwtPayload }) {
    return this.orders.getHistory(req.customer.sub)
  }
}
