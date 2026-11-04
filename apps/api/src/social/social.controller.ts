import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { ConnectSocialSchema, PublishProductSocialSchema, SocialCaptionQuerySchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'
import { SocialService } from './social.service'

class ConnectSocialDto extends createZodDto(ConnectSocialSchema) {}
class PublishProductSocialDto extends createZodDto(PublishProductSocialSchema) {}
class SocialCaptionQueryDto extends createZodDto(SocialCaptionQuerySchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

const actorFrom = (req: AuthedRequest): AuditActor => ({ id: req.user.sub, email: req.user.email })

// Store-wide social pages (one set for the whole platform, not per admin) and
// posting a product to them.
@ApiTags('social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
@Controller('admin/social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('status')
  status() {
    return this.social.status()
  }

  @Post('connect')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  connect(@Body() body: ConnectSocialDto, @Req() req: AuthedRequest) {
    return this.social.connect(body, actorFrom(req))
  }

  @Delete('accounts/:id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.social.removeAccount(id, actorFrom(req))
  }

  @Get('products/:productId/caption')
  caption(@Param('productId') productId: string, @Query() query: SocialCaptionQueryDto) {
    return this.social.caption(productId, query.language)
  }

  @Get('products/:productId/posts')
  posts(@Param('productId') productId: string) {
    return this.social.posts(productId)
  }

  @Post('products/:productId/publish')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  publish(@Param('productId') productId: string, @Body() body: PublishProductSocialDto, @Req() req: AuthedRequest) {
    return this.social.publish(productId, body, actorFrom(req))
  }
}
