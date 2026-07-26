import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import type { Env } from '../config/env.validation'

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)

  constructor(config: ConfigService<Env, true>) {
    super(config.get('REDIS_URL', { infer: true }), { lazyConnect: true })
  }

  async onModuleInit() {
    await this.connect()
    this.logger.log('Connected to Redis')
  }

  onModuleDestroy() {
    this.disconnect()
  }
}
