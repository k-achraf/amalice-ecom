import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { RecordPageViewSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import { AnalyticsService } from './analytics.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'

class RecordPageViewDto extends createZodDto(RecordPageViewSchema) {}

// Public write (no auth — the caller is an anonymous storefront visitor,
// same trust model as the checkout endpoints) + one admin-only read. A
// generous override of the 'default' throttle bucket, not @SkipThrottle —
// this fires once per page a real visitor loads, which can add up across a
// browsing session; the default 60/min bucket is shared with every other
// API call that visitor's browser makes (SSR fetches, etc.), so a tight
// budget here would risk throttling unrelated legitimate requests.
@ApiTags('analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('analytics/view')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  async recordView(@Body() body: RecordPageViewDto) {
    await this.analytics.recordView(body)
    return { ok: true }
  }

  // Admin dashboard's "storefront traffic" section — every role sees the
  // dashboard (each gets a different view, see apps/admin's index.vue), so
  // every role can read this rather than one 403-ing while fetching it
  // unconditionally on page load.
  @Get('admin/analytics/overview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse')
  overview(@Query('days') days: string = '7') {
    return this.analytics.getOverview(Number(days) || 7)
  }
}
