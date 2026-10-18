import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AskAssistantSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import { AiAssistantService } from './ai-assistant.service'
import { AiService } from './ai.service'

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

class AskAssistantDto extends createZodDto(AskAssistantSchema) {}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/ai')
export class AiController {
  constructor(
    private readonly assistant: AiAssistantService,
    private readonly ai: AiService
  ) {}

  // Each question can fan out into several model calls, so it gets its own
  // tighter per-route limit than the global default.
  @Post('assistant')
  @HttpCode(200)
  @Roles('SuperAdmin', 'OpsManager', 'Finance')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  ask(@Body() body: AskAssistantDto, @Req() req: AuthedRequest) {
    return this.assistant.ask(body, { adminUserId: req.user.sub })
  }

  // Model requests and tokens per Algiers day (last 7).
  @Get('usage')
  @Roles('SuperAdmin', 'OpsManager', 'Finance')
  usage() {
    return this.ai.usage(7)
  }
}
