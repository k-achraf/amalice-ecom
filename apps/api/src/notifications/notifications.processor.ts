import { Inject, Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'
import { NOTIFICATION_PROVIDER, type NotificationProvider } from './notification-provider.interface'

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER) private readonly provider: NotificationProvider
  ) {
    super()
  }

  async process(job: Job<{ notificationId: string }>): Promise<void> {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: job.data.notificationId }
    })

    try {
      await this.provider.send(notification.channel, notification.recipient, notification.message)
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'Sent', attempts: { increment: 1 } }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'Failed', attempts: { increment: 1 }, lastError: message }
      })
      this.logger.warn(`Notification ${notification.id} attempt failed: ${message}`)
      // Rethrow — this is what makes BullMQ's attempts/backoff config
      // actually retry the job instead of silently treating it as done.
      throw error
    }
  }
}
