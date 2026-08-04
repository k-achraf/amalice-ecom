import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CreateGoogleSheetSchema, UpdateGoogleSheetSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { GoogleSheetsService } from './google-sheets.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class CreateGoogleSheetDto extends createZodDto(CreateGoogleSheetSchema) {}
class UpdateGoogleSheetDto extends createZodDto(UpdateGoogleSheetSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Admin-only CRUD for connected sheets + the product-mapping that drives
// which orders route where — see GoogleSheet's Prisma comment for the
// routing rules. The actual "on/off" master switch for the whole feature is
// the generic GET/PUT /admin/apps/google-sheets (AppsController), same as
// every other app; these endpoints manage the per-sheet detail underneath it.
@ApiTags('apps')
@Controller('admin/google-sheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class GoogleSheetsController {
  constructor(private readonly googleSheets: GoogleSheetsService) {}

  @Get()
  list() {
    return this.googleSheets.list()
  }

  @Post()
  create(@Body() body: CreateGoogleSheetDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.googleSheets.create(body, actor)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateGoogleSheetDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.googleSheets.update(id, body, actor)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.googleSheets.remove(id, actor)
  }

  // Fires a real request at the Sheets API so the admin gets immediate
  // feedback (most common failure: forgot to share the sheet with the
  // service account) — throttled like the pixel apps' test-event endpoints,
  // it's an outbound third-party call, not a cheap local read.
  @Post(':id/test-connection')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  testConnection(@Param('id') id: string) {
    return this.googleSheets.testConnection(id)
  }

  // On-demand pull sync — the same reconciliation the repeatable poll job
  // (every 2 minutes, see GoogleSheetsService.onModuleInit) already runs,
  // exposed for "I just edited the sheet, don't want to wait" and for
  // verifying the two-way sync actually works. Throttled like
  // test-connection since it's also an outbound-heavy third-party call.
  @Post('sync-now')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async syncNow() {
    await this.googleSheets.pollAllSheets()
    return { ok: true }
  }
}
