import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { AiTierTestSchema, AskAssistantSchema, SetAiProviderKeySchema, UpdateAiSettingsSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import { AiAssistantService } from './ai-assistant.service'
import { AiService } from './ai.service'
import { AiSettingsService } from './ai-settings.service'

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

class AskAssistantDto extends createZodDto(AskAssistantSchema) {}
class UpdateAiSettingsDto extends createZodDto(UpdateAiSettingsSchema) {}
class SetAiProviderKeyDto extends createZodDto(SetAiProviderKeySchema) {}
class AiTierTestDto extends createZodDto(AiTierTestSchema) {}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/ai')
export class AiController {
  constructor(
    private readonly assistant: AiAssistantService,
    private readonly ai: AiService,
    private readonly settings: AiSettingsService
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

  // ---- Settings → AI models (SuperAdmin) ----------------------------------
  // Provider keys are write-only: no endpoint ever returns one.

  @Get('settings')
  @Roles('SuperAdmin')
  getSettings() {
    return this.settings.view()
  }

  @Put('settings')
  @Roles('SuperAdmin')
  updateSettings(@Body() body: UpdateAiSettingsDto, @Req() req: AuthedRequest) {
    return this.settings.update(body, { id: req.user.sub, email: req.user.email })
  }

  @Put('providers/:provider/key')
  @Roles('SuperAdmin')
  setKey(@Param('provider') provider: string, @Body() body: SetAiProviderKeyDto, @Req() req: AuthedRequest) {
    return this.settings.setKey(this.settings.assertProvider(provider), body.apiKey, body.baseUrl, { id: req.user.sub, email: req.user.email })
  }

  @Delete('providers/:provider/key')
  @Roles('SuperAdmin')
  clearKey(@Param('provider') provider: string, @Req() req: AuthedRequest) {
    return this.settings.clearKey(this.settings.assertProvider(provider), { id: req.user.sub, email: req.user.email })
  }

  // Models the provider offers for the saved key (also proves the key works).
  @Get('providers/:provider/models')
  @Roles('SuperAdmin')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  models(@Param('provider') provider: string) {
    return this.settings.listModels(this.settings.assertProvider(provider))
  }

  // One tiny request against exactly the chosen provider/model of a tier.
  @Post('test')
  @HttpCode(200)
  @Roles('SuperAdmin')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  test(@Body() body: AiTierTestDto) {
    return this.ai.testTier(body.tier)
  }
}
