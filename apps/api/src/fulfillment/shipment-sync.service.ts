import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { FulfillmentService } from './fulfillment.service'

// Periodic safety net next to the courier webhooks: every few minutes each
// linked shipping company's active parcels are re-read from its API, so a missed
// or unsigned webhook can't leave an order stuck in the wrong state. A Redis
// lock keeps several API instances from running the same pass at once.
// Disable with COURIER_SYNC_DISABLED=1.
@Injectable()
export class ShipmentSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShipmentSyncService.name)
  private interval?: ReturnType<typeof setInterval>
  private first?: ReturnType<typeof setTimeout>

  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly redis: RedisService
  ) {}

  onModuleInit() {
    if (process.env.COURIER_SYNC_DISABLED === '1' || process.env.NODE_ENV === 'test') return
    this.first = setTimeout(() => void this.tick(), 60_000)
    this.interval = setInterval(() => void this.tick(), 5 * 60_000)
  }

  onModuleDestroy() {
    if (this.first) clearTimeout(this.first)
    if (this.interval) clearInterval(this.interval)
  }

  async tick() {
    const acquired = await this.redis.set('courier-sync:lock', '1', 'EX', 240, 'NX').catch(() => null)
    if (!acquired) return
    try {
      const summary = await this.fulfillment.syncAllCompanies()
      const applied = summary.reduce((n, s) => n + s.applied, 0)
      if (applied) this.logger.log(`Courier sync applied ${applied} status change(s)`)
    } catch (error) {
      this.logger.warn(`Courier sync pass failed: ${(error as Error).message}`)
    }
  }
}
