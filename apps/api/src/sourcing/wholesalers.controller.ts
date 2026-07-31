import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CreateWholesalerSchema, UpdateWholesalerSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { WholesalersService } from './wholesalers.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class CreateWholesalerDto extends createZodDto(CreateWholesalerSchema) {}
class UpdateWholesalerDto extends createZodDto(UpdateWholesalerSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

@ApiTags('sourcing-wholesalers')
@Controller('admin/sourcing/wholesalers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
export class WholesalersController {
  constructor(private readonly wholesalers: WholesalersService) {}

  @Get()
  list() {
    return this.wholesalers.list()
  }

  @Post()
  create(@Body() body: CreateWholesalerDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.wholesalers.create(body, actor)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateWholesalerDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.wholesalers.update(id, body, actor)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.wholesalers.remove(id, actor)
  }
}
