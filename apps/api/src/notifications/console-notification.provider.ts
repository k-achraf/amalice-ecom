import { Injectable, Logger } from '@nestjs/common'
import type { NotificationChannel } from '../generated/prisma/client'
import type { NotificationProvider } from './notification-provider.interface'

// Dev-only stand-in — logs instead of sending. See otp/console-otp.provider
// for the same pattern already established in FND-07.
@Injectable()
export class ConsoleNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('Notifications')

  async send(channel: NotificationChannel, recipient: string, message: string): Promise<void> {
    this.logger.log(`[${channel}] to ${recipient}: ${message}`)
  }
}
