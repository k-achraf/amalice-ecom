import { Injectable, Logger } from '@nestjs/common'
import type { NotificationChannel } from '../generated/prisma/client'
import type { NotificationProvider } from './notification-provider.interface'

// Dev-only stand-in — logs instead of sending.
@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('Notifications')

  async send(channel: NotificationChannel, recipient: string, message: string): Promise<void> {
    this.logger.log(`[${channel}] to ${recipient}: ${message}`)
  }
}
