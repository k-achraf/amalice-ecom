import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { createZodDto } from 'nestjs-zod'
import { PosOrderSchema } from '@amalice/shared'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import { AuditService } from '../common/audit.service'
import { OrdersService } from '../orders/orders.service'
import { PosService } from './pos.service'

class PosOrderDto extends createZodDto(PosOrderSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// POS: orders typed in by staff from social media / chat / phone conversations.
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
export class PosController {
  constructor(
    private readonly orders: OrdersService,
    private readonly pos: PosService,
    private readonly audit: AuditService
  ) {}

  @Get('products')
  products(@Query('search') search?: string) {
    return this.pos.products(search)
  }

  @Get('recent')
  recent() {
    return this.pos.recent()
  }

  @Post('orders')
  async create(@Body() body: PosOrderDto, @Req() req: AuthedRequest) {
    const result = await this.orders.createPosOrder(body)
    await this.audit.log({
      actor: { id: req.user.sub, email: req.user.email },
      action: 'Create',
      entity: 'Order',
      entityId: result.orderId,
      metadata: { pos: true, source: body.source, sourceNote: body.sourceNote ?? null, confirmNow: body.confirmNow, state: result.state, totalCents: result.totalCents }
    })
    return result
  }
}
