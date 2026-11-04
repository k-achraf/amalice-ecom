import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CreateMcpTokenSchema, UpdateMcpTokenSchema, type McpSelf } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AuditActor } from '../common/audit.service'
import { McpEndpointCatalog } from './mcp-endpoint-catalog.service'
import type { McpPrincipal } from './mcp-token.strategy'
import { McpTokensService } from './mcp-tokens.service'

class CreateMcpTokenDto extends createZodDto(CreateMcpTokenSchema) {}
class UpdateMcpTokenDto extends createZodDto(UpdateMcpTokenSchema) {}

type AuthedRequest = Request & { user: { sub: string; email: string } }
const actorOf = (req: AuthedRequest): AuditActor => ({ id: req.user.sub, email: req.user.email })

// Token management: SuperAdmin through the admin UI only. An agent token can never reach this
// (/admin/mcp-tokens is not in any ability section, so it is denied before the handler runs).
@ApiTags('mcp-tokens')
@ApiBearerAuth()
@Controller('admin/mcp-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class McpTokensController {
  constructor(private readonly tokens: McpTokensService) {}

  @Get()
  list() {
    return this.tokens.list()
  }

  @Post()
  create(@Body() body: CreateMcpTokenDto, @Req() req: AuthedRequest) {
    return this.tokens.create(body, actorOf(req))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateMcpTokenDto, @Req() req: AuthedRequest) {
    return this.tokens.update(id, body, actorOf(req))
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.tokens.revoke(id, actorOf(req))
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.tokens.remove(id, actorOf(req))
  }
}

// Endpoints an agent token may call about itself. Outside /admin on purpose.
@ApiTags('mcp')
@ApiBearerAuth()
@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpSelfController {
  constructor(private readonly catalog: McpEndpointCatalog) {}

  private principal(req: Request): McpPrincipal {
    const user = (req as Request & { user?: McpPrincipal }).user
    if (!user?.mcp) throw new BadRequestException('This endpoint is for AI-agent tokens')
    return user
  }

  @Get('self')
  self(@Req() req: Request): McpSelf {
    return this.principal(req).mcp
  }

  // Every admin endpoint this token is allowed to call (method, path, ability, params, body schema).
  @Get('endpoints')
  endpoints(@Req() req: Request, @Query('q') q?: string, @Query('section') section?: string) {
    return this.catalog.list(this.principal(req).mcp.abilities, { q, section })
  }
}
