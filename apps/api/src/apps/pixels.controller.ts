import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CreatePixelSchema, SendPixelTestEventSchema, UpdatePixelSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { PixelsService } from './pixels.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class CreatePixelDto extends createZodDto(CreatePixelSchema) {}
class UpdatePixelDto extends createZodDto(UpdatePixelSchema) {}
class SendPixelTestEventDto extends createZodDto(SendPixelTestEventSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Named pixels (Apps → Pixels). SuperAdmin + MCP tokens with the integrations ability.
@ApiTags('pixels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
@Controller('admin/pixels')
export class PixelsController {
  constructor(private readonly pixels: PixelsService) {}

  private actor(req: AuthedRequest): AuditActor {
    return { id: req.user.sub, email: req.user.email }
  }

  @Get()
  list() {
    return this.pixels.list()
  }

  @Post()
  create(@Body() body: CreatePixelDto, @Req() req: AuthedRequest) {
    return this.pixels.create(body, this.actor(req))
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePixelDto, @Req() req: AuthedRequest) {
    return this.pixels.update(id, body, this.actor(req))
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.pixels.remove(id, this.actor(req))
  }

  @Post(':id/test-event')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  sendTestEvent(@Param('id', ParseUUIDPipe) id: string, @Body() body: SendPixelTestEventDto) {
    return this.pixels.sendTestEvent(id, body.eventName)
  }
}
