import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AskAssistantSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import { AiAssistantService } from './ai-assistant.service'

class AskAssistantDto extends createZodDto(AskAssistantSchema) {}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/ai')
export class AiController {
  constructor(private readonly assistant: AiAssistantService) {}

  // Each question can fan out into several model calls, so it gets its own
  // tighter per-route limit than the global default.
  @Post('assistant')
  @HttpCode(200)
  @Roles('SuperAdmin', 'OpsManager', 'Finance')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  ask(@Body() body: AskAssistantDto) {
    return this.assistant.ask(body)
  }
}
