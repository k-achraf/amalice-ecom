import { Global, Module } from '@nestjs/common'
import { AuditService } from './audit.service'
import { StockService } from './stock.service'
import { PersistentLogger } from './persistent-logger.service'

// Shared infrastructure — AuditService is used by the admin, orders, and
// reconciliation modules. Global so it can be injected without each module
// re-importing CommonModule (same pattern as PrismaModule/RedisModule).
// PersistentLogger lives here too (cross-cutting logging infra, same
// category as AuditService) — main.ts resolves it via `app.get()` before
// `.listen()` and registers it as the app-wide logger.
@Global()
@Module({
  providers: [AuditService, PersistentLogger, StockService],
  exports: [AuditService, PersistentLogger, StockService],
  imports: []
})
export class CommonModule {}
