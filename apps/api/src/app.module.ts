import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { BullModule } from '@nestjs/bullmq'
import { ZodValidationPipe } from 'nestjs-zod'
import Redis from 'ioredis'
import { validateEnv, type Env } from './config/env.validation'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { CatalogModule } from './catalog/catalog.module'
import { OrdersModule } from './orders/orders.module'
import { AdminModule } from './admin/admin.module'
import { FulfillmentModule } from './fulfillment/fulfillment.module'
import { ReconciliationModule } from './reconciliation/reconciliation.module'
import { IdentityModule } from './identity/identity.module'
import { NotificationsModule } from './notifications/notifications.module'
import { StoreSettingsModule } from './store-settings/store-settings.module'
import { LocationsModule } from './locations/locations.module'
import { AppsModule } from './apps/apps.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Only 'default' registered here — see SEC-02 for broader enforcement
    // across every route. ThrottlerGuard checks EVERY named throttler
    // registered in forRoot against EVERY route by default (unless
    // @SkipThrottle'd), so a second globally-registered named throttler
    // (e.g. a stricter one meant only for OTP) would silently apply its
    // tight limit to unrelated routes like the product catalog too — this
    // was caught as a real bug (catalog browsing rate-limited to 5 req/5min
    // by an OTP-only bucket) and fixed by having the OTP routes override
    // 'default' per-route via @Throttle instead of introducing new names.
    // The generated storage key already includes controller+handler name,
    // so /request and /verify still get fully independent counters from
    // each other and from every other route without a shared-bucket risk.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    RedisModule,
    // A dedicated ioredis connection, not RedisService — BullMQ's worker
    // holds blocking commands open on its connection, which would starve
    // RedisService's own OTP-code reads/writes if they shared one.
    // maxRetriesPerRequest: null is a hard BullMQ requirement, not a
    // stylistic choice — its blocking commands break without it.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: new Redis(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: null })
      })
    }),
    CatalogModule,
    OrdersModule,
    AdminModule,
    FulfillmentModule,
    ReconciliationModule,
    IdentityModule,
    NotificationsModule,
    StoreSettingsModule,
    LocationsModule,
    AppsModule
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
