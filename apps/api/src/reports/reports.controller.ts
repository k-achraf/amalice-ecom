import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { UpdateReportSettingsSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import { ReportSettingsService } from './report-settings.service'
import { ReportsService } from './reports.service'

class UpdateReportSettingsDto extends createZodDto(UpdateReportSettingsSchema) {}
interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
@Controller('admin/reports')
export class ReportsController {
  constructor(
    private readonly settings: ReportSettingsService,
    private readonly reports: ReportsService
  ) {}

  @Get('settings')
  get() {
    return this.settings.view()
  }

  @Put('settings')
  update(@Body() body: UpdateReportSettingsDto, @Req() req: AuthedRequest) {
    return this.settings.update(body, { id: req.user.sub, email: req.user.email })
  }

  @Post('test')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async test() {
    await this.reports.sendTest()
    return { ok: true }
  }

  // Sends today's summary right now (does not affect the scheduled one).
  @Post('send-now')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async sendNow() {
    await this.reports.sendDailyReport()
    return { ok: true }
  }
}
