import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AdminLoginSchema, AdminRefreshSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { AdminAuthService } from './admin-auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { Roles } from './roles.decorator'
import type { AdminJwtPayload } from './jwt-payload.interface'

class AdminLoginDto extends createZodDto(AdminLoginSchema) {}
class AdminRefreshDto extends createZodDto(AdminRefreshSchema) {}

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: AdminJwtPayload['role'] }
}

@ApiTags('auth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() body: AdminLoginDto) {
    return this.auth.login(body.email, body.password)
  }

  @Post('refresh')
  refresh(@Body() body: AdminRefreshDto) {
    return this.auth.refresh(body.refreshToken)
  }

  // Proves JwtAuthGuard alone: any authenticated admin, any role.
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return req.user
  }

  // Proves JwtAuthGuard + RolesGuard together: authenticated AND the right
  // role. This one route is the acceptance-criteria proof for FND-08 — full
  // enforcement across every admin module is SEC-01.
  @Get('super-admin-only')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  superAdminOnly(@Req() req: AuthenticatedRequest) {
    return { message: 'You are a SuperAdmin', user: req.user }
  }
}
