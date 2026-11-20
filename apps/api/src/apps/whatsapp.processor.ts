import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { WhatsAppService } from './whatsapp.service'

// Delayed jobs: the abandoned-cart WhatsApp message goes out only after the configured wait (see
// WhatsAppService.scheduleAbandoned), and only if the cart is still abandoned at that point.
@Processor('whatsapp')
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name)

  constructor(private readonly whatsapp: WhatsAppService) {
    super()
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    try {
      await this.whatsapp.sendDueAbandoned(job.data.orderId)
    } catch (error) {
      // Not rethrown: the order is already marked Failed with the reason, a retry could double-send.
      this.logger.warn(`WhatsApp abandoned-cart message failed for order ${job.data.orderId}: ${(error as Error).message}`)
    }
  }
}
