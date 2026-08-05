import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  ImportRemittanceSchema,
  ResolveDiscrepancySchema,
  type RemittanceBatchStatus
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { ReconciliationService } from './reconciliation.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class ImportRemittanceDto extends createZodDto(ImportRemittanceSchema) {}
class ResolveDiscrepancyDto extends createZodDto(ResolveDiscrepancySchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Public health stays at /reconciliation/health (unauthenticated, like every
// other module's health route). The finance surface lives under /admin/
// reconciliation and is Finance-role-gated. Every mutation is audit-logged
// (SEC-03) — this module handles money, so the trail matters.
@ApiTags('reconciliation')
@Controller()
export class ReconciliationController {
  constructor(private readonly recon: ReconciliationService) {}

  @Get('reconciliation/health')
  health() {
    return { module: 'reconciliation', status: 'ok' }
  }

  @Get('admin/reconciliation/batches')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  batches(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('status') status: RemittanceBatchStatus | undefined
  ) {
    return this.recon.listBatches({ page: Number(page), pageSize: Number(pageSize), status })
  }

  @Get('admin/reconciliation/batches/:id/entries')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  entries(@Param('id') id: string) {
    return this.recon.batchEntries(id)
  }

  // Powers the import modal's courier dropdown — see
  // ReconciliationService.listCouriers.
  @Get('admin/reconciliation/couriers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  couriers() {
    return this.recon.listCouriers()
  }

  // FIN-02 — import a courier remittance batch.
  @Post('admin/reconciliation/batches')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  importBatch(@Body() body: ImportRemittanceDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.recon.importBatch(body, actor)
  }

  // FIN-03 — run auto-match on a batch.
  @Post('admin/reconciliation/batches/:id/match')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  match(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.recon.autoMatch(id, actor)
  }

  // FIN-04 — the discrepancy review queue.
  @Get('admin/reconciliation/discrepancies')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  discrepancies() {
    return this.recon.discrepancyQueue()
  }

  @Post('admin/reconciliation/entries/:id/resolve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Finance')
  resolve(@Param('id') id: string, @Body() body: ResolveDiscrepancyDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.recon.resolveDiscrepancy(id, body.resolutionNote, actor)
  }
}
