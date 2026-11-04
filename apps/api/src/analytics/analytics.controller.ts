import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { RecordPageEngagementSchema, RecordPageViewSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import { AnalyticsService } from './analytics.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'

class RecordPageViewDto extends createZodDto(RecordPageViewSchema) {}
class RecordPageEngagementDto extends createZodDto(RecordPageEngagementSchema) {}

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
  async recordView(@Body() body: RecordPageViewDto, @Req() req: Request) {
    await this.analytics.recordView(body, req.headers['user-agent'])
    return { ok: true }
  }

  // Funnel pages report time on page / scroll depth when the visitor leaves.
  @Post('analytics/engagement')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  async recordEngagement(@Body() body: RecordPageEngagementDto) {
    await this.analytics.recordEngagement(body)
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

  // Visitor list + one visitor's journey (page views, funnel session
  // recordings, orders). Used by the MCP server and available to the admin.
  @Get('admin/analytics/visitors')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  visitors(
    @Query('days') days: string = '7',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '25',
    @Query('source') source?: string,
    @Query('type') type?: string
  ) {
    return this.analytics.listVisitors({
      days: Math.min(90, Math.max(1, Math.floor(Number(days)) || 7)),
      page: Math.max(1, Math.floor(Number(page)) || 1),
      pageSize: Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 25)),
      source: source || undefined,
      type: type || undefined
    })
  }

  @Get('admin/analytics/visitors/:visitorId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  visitor(@Param('visitorId') visitorId: string) {
    return this.analytics.getVisitor(visitorId)
  }
}
