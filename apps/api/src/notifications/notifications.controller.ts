import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { module: 'notifications', status: 'ok' }
  }

  // Minimal "visible to support" proof — the real admin UI for this is the
  // ADM track. Delivery status/attempts/lastError are already queryable
  // here, which is the part this task actually owns.
  @Get('order/:orderId')
  byOrder(@Param('orderId') orderId: string) {
    return this.prisma.notification.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    })
  }
}
