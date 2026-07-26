import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PrismaService } from '../prisma/prisma.service'
import type { NotificationChannel } from '../generated/prisma/client'

export interface EnqueueNotificationInput {
  channel: NotificationChannel
  recipient: string
  message: string
  orderId?: string
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly prisma: PrismaService
  ) {}

  async enqueue(input: EnqueueNotificationInput) {
    // Row created before the job runs — "Pending" is a real, queryable
    // state from the moment of enqueue, not just an in-memory queue item
    // support has no visibility into until it succeeds or exhausts retries.
    const notification = await this.prisma.notification.create({
      data: {
        channel: input.channel,
        recipient: input.recipient,
        message: input.message,
        orderId: input.orderId
      }
    })

    await this.queue.add(
      'send',
      { notificationId: notification.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    )

    return notification
  }
}
