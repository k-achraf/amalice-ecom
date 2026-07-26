import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { UpdateAppInstallationSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { AppsService } from './apps.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class UpdateAppInstallationDto extends createZodDto(UpdateAppInstallationSchema) {}

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
}
