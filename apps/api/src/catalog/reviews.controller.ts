import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CreateReviewSchema, type RatingSummary, type Review } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { ReviewsService } from './reviews.service'
import { CustomerAuthGuard, type CustomerJwtPayload } from '../identity/otp/customer-auth.guard'

class CreateReviewDto extends createZodDto(CreateReviewSchema) {}

@ApiTags('catalog')
@Controller('products')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Public — approved reviews + aggregate for the PDP. No auth; the product
  // id is public anyway.
  @Get(':slug/reviews')
  async list(@Param('slug') slug: string): Promise<{ summary: RatingSummary; items: Review[] }> {
    const product = await this.reviews.findBySlugOrThrow(slug)
    const [summary, items] = await Promise.all([
      this.reviews.ratingSummary(product.id),
      this.reviews.listApproved(product.id)
    ])
    return { summary, items }
  }

  // SF-16 — phone-OTP gated. The customer JWT (from POST /auth/otp/verify)
  // identifies the reviewer; delivery-history is checked in the service.
  @Post(':slug/reviews')
  @UseGuards(CustomerAuthGuard)
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateReviewDto,
    @Req() req: Request & { customer: CustomerJwtPayload }
  ): Promise<Review> {
    const product = await this.reviews.findBySlugOrThrow(slug)
    return this.reviews.create(product.id, req.customer.sub, body)
  }
}
