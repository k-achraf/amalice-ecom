import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { NotificationsProcessor } from './notifications.processor'
import { NOTIFICATION_PROVIDER } from './notification-provider.interface'
import { ConsoleNotificationProvider } from './console-notification.provider'

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    { provide: NOTIFICATION_PROVIDER, useClass: ConsoleNotificationProvider }
  ],
  exports: [NotificationsService]
})
export class NotificationsModule {}
