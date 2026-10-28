import { Logger, type OnModuleInit } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { DeliveryEventsService } from './delivery-events.service'
import { ReportsService } from './reports.service'
import { CallCenterSweepService } from './call-center-sweep.service'

// Entry point of the repeatable jobs registered in onModuleInit below.
// Never rethrows: a failed cycle just waits for the next tick.
@Processor('reports')
export class ReportsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ReportsProcessor.name)

  constructor(
    @InjectQueue('reports') private readonly queue: Queue,
    private readonly deliveryEvents: DeliveryEventsService,
    private readonly reports: ReportsService,
    private readonly callCenterSweep: CallCenterSweepService
  ) {
    super()
  }

  // Repeatable jobs are deduped by name + options, so this is idempotent across restarts.
  async onModuleInit(): Promise<void> {
    await this.queue.add('delivery-sweep', {}, { repeat: { every: 5 * 60_000 }, jobId: 'delivery-sweep' })
    await this.queue.add('daily-tick', {}, { repeat: { every: 10 * 60_000 }, jobId: 'daily-tick' })
    await this.queue.add('alerts-tick', {}, { repeat: { every: 30 * 60_000 }, jobId: 'alerts-tick' })
    await this.queue.add('call-center-archive', {}, { repeat: { every: 10 * 60_000 }, jobId: 'call-center-archive' })
  }

  async process(job: Job): Promise<void> {
    try {
      if (job.name === 'delivery-sweep') await this.deliveryEvents.sweep()
      else if (job.name === 'daily-tick') await this.reports.dailyTick()
      else if (job.name === 'alerts-tick') await this.reports.alertsTick()
      else if (job.name === 'call-center-archive') await this.callCenterSweep.archiveStaleNoAnswer()
    } catch (error) {
      this.logger.warn(`Reports job '${job.name}' failed: ${(error as Error).message}`)
    }
  }
}
