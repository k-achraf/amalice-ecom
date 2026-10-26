import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  CreateFunnelSchema,
  CreateFunnelStepSchema,
  GenerateFunnelSchema,
  FUNNEL_TEMPLATES,
  ReorderFunnelStepsSchema,
  UpdateFunnelSchema,
  UpdateFunnelStepSchema
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { FunnelsService } from './funnels.service'
import { FunnelsStatsService } from './funnels-stats.service'
import { FunnelsRecordingsService } from './funnels-recordings.service'
import { FunnelsAiService } from './funnels-ai.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class CreateFunnelDto extends createZodDto(CreateFunnelSchema) {}
class GenerateFunnelDto extends createZodDto(GenerateFunnelSchema) {}
class UpdateFunnelDto extends createZodDto(UpdateFunnelSchema) {}
class CreateFunnelStepDto extends createZodDto(CreateFunnelStepSchema) {}
class UpdateFunnelStepDto extends createZodDto(UpdateFunnelStepSchema) {}
class ReorderFunnelStepsDto extends createZodDto(ReorderFunnelStepsSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

const actorOf = (req: AuthedRequest): AuditActor => ({ id: req.user.sub, email: req.user.email })

@ApiTags('funnels')
@Controller('admin/funnels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
export class FunnelsController {
  constructor(
    private readonly funnels: FunnelsService,
    private readonly stats: FunnelsStatsService,
    private readonly ai: FunnelsAiService,
    private readonly recordings: FunnelsRecordingsService
  ) {}

  // Static catalog from packages/shared — declared before ':id' so it is not captured as an id.
  @Get('templates')
  templates() {
    return FUNNEL_TEMPLATES
  }

  // One click: the AI plans the whole funnel for a product and saves it as a Draft.
  @Post('ai-generate')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  aiGenerate(@Body() body: GenerateFunnelDto, @Req() req: AuthedRequest) {
    return this.ai.generate(body, actorOf(req))
  }

  @Get()
  list() {
    return this.funnels.list()
  }

  // Session replays of this funnel's visits (newest first) and one recording's events for the player.
  @Get(':id/recordings')
  recordingsOf(@Param('id') id: string, @Query('page') page = '1') {
    return this.recordings.list(id, Math.max(1, Math.floor(Number(page)) || 1))
  }

  @Get(':id/recordings/:viewId')
  recording(@Param('id') id: string, @Param('viewId') viewId: string) {
    return this.recordings.get(id, viewId)
  }

  @Delete(':id/recordings/:viewId')
  async deleteRecording(@Param('id') id: string, @Param('viewId') viewId: string) {
    await this.recordings.remove(id, viewId)
    return { ok: true }
  }

  @Get(':id/stats')
  statsOf(@Param('id') id: string, @Query('days') days = '30') {
    return this.stats.stats(id, Math.min(365, Math.max(1, Math.floor(Number(days)) || 30)))
  }

  // Which A/B test to run next, from the funnel's own stats (rules, no AI).
  @Get(':id/next-test')
  nextTest(@Param('id') id: string, @Query('days') days = '30') {
    return this.stats.nextTest(id, Math.min(365, Math.max(1, Math.floor(Number(days)) || 30)))
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.funnels.get(id)
  }

  @Post()
  create(@Body() body: CreateFunnelDto, @Req() req: AuthedRequest) {
    return this.funnels.create(body, actorOf(req))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateFunnelDto, @Req() req: AuthedRequest) {
    return this.funnels.update(id, body, actorOf(req))
  }

  @Roles('SuperAdmin')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.funnels.remove(id, actorOf(req))
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.funnels.duplicate(id, actorOf(req))
  }

  @Post(':id/steps')
  addStep(@Param('id') id: string, @Body() body: CreateFunnelStepDto, @Req() req: AuthedRequest) {
    return this.funnels.addStep(id, body, actorOf(req))
  }

  @Post(':id/steps/reorder')
  reorder(@Param('id') id: string, @Body() body: ReorderFunnelStepsDto, @Req() req: AuthedRequest) {
    return this.funnels.reorder(id, body, actorOf(req))
  }

  @Patch(':id/steps/:stepId')
  updateStep(@Param('id') id: string, @Param('stepId') stepId: string, @Body() body: UpdateFunnelStepDto, @Req() req: AuthedRequest) {
    return this.funnels.updateStep(id, stepId, body, actorOf(req))
  }

  @Delete(':id/steps/:stepId')
  removeStep(@Param('id') id: string, @Param('stepId') stepId: string, @Req() req: AuthedRequest) {
    return this.funnels.removeStep(id, stepId, actorOf(req))
  }
}
