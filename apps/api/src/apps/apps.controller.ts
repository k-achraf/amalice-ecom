import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { SendMetaPixelTestEventSchema, SendTikTokPixelTestEventSchema, UpdateAppInstallationSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { AppsService } from './apps.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class UpdateAppInstallationDto extends createZodDto(UpdateAppInstallationSchema) {}
class SendMetaPixelTestEventDto extends createZodDto(SendMetaPixelTestEventSchema) {}
class SendTikTokPixelTestEventDto extends createZodDto(SendTikTokPixelTestEventSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Two surfaces, same shape as store-settings: a PUBLIC per-app GET (the
// storefront reads only the one app it knows how to inject) and an admin
// list/update pair (SuperAdmin, audit-logged).
@ApiTags('apps')
@Controller()
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  // Public — the storefront fetches this on every page load to decide
  // whether to inject the Meta Pixel script. No auth; no PII. Exempt from
  // the global throttler for the same reason as GET /settings: it must
  // never 429 a visitor's page load.
  @Get('apps/meta-pixel')
  @SkipThrottle({ default: true })
  getMetaPixelPublic() {
    return this.apps.getPublicMetaPixel()
  }

  // Same as above, for the TikTok Pixel app.
  @Get('apps/tiktok-pixel')
  @SkipThrottle({ default: true })
  getTikTokPixelPublic() {
    return this.apps.getPublicTikTokPixel()
  }

  @Get('admin/apps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  list() {
    return this.apps.listForAdmin()
  }

  @Put('admin/apps/:appId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  update(@Param('appId') appId: string, @Body() body: UpdateAppInstallationDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.apps.update(appId, body, actor)
  }

  // Fires one real request at Meta's Conversions API so the admin can watch
  // it land in Events Manager's Test Events tab without waiting for an
  // actual order. Throttled tighter than the default — it's an outbound
  // call to a third party, not a cheap local read.
  @Post('admin/apps/meta-pixel/test-event')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  sendMetaPixelTestEvent(@Body() body: SendMetaPixelTestEventDto) {
    return this.apps.sendMetaPixelTestEvent(body.eventName)
  }

  // Same as above, for TikTok's Events API.
  @Post('admin/apps/tiktok-pixel/test-event')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  sendTikTokPixelTestEvent(@Body() body: SendTikTokPixelTestEventDto) {
    return this.apps.sendTikTokPixelTestEvent(body.eventName)
  }
}
