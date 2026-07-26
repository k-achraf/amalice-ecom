import { Module } from '@nestjs/common'
import { AuditService } from './audit.service'

// Shared infrastructure — AuditService is used by the admin, orders, and
// reconciliation modules. Global so it can be injected without each module
// re-importing CommonModule (same pattern as PrismaModule/RedisModule).
@Module({
  providers: [AuditService],
  exports: [AuditService],
  imports: []
})
export class CommonModule {}
