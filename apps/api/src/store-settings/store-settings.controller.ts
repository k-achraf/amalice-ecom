import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { UpdateStoreSettingsSchema, type UpdateStoreSettings } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { StoreSettingsService } from './store-settings.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class UpdateStoreSettingsDto extends createZodDto(UpdateStoreSettingsSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Two surfaces: a PUBLIC GET /settings (unauthenticated, cached, drives the
// storefront template resolver) and an admin GET/PUT (SuperAdmin, audit-logged).
@ApiTags('store-settings')
@Controller()
export class StoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  // Public — the storefront prefetches this on boot to resolve the active
  // template + announcement text. No auth; no PII; safe to cache. Exempt from
  // the global throttler: this is a cheap singleton read the storefront fetches
  // on every SSR request, and it must never 429 (a throttle here would silently
  // revert the storefront to the fallback template).
  @Get('settings')
  @SkipThrottle({ default: true })
  findPublic() {
    return this.settings.getPublic()
  }

  @Get('admin/settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  findForAdmin() {
    return this.settings.getForAdmin()
  }

  @Put('admin/settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  update(@Body() body: UpdateStoreSettingsDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.settings.update(body as UpdateStoreSettings, actor)
  }
}
