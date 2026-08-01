import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { ServerPerformanceService } from './server-performance.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'

// SuperAdmin-only — server resource usage (disk paths, process names,
// dependency errors) is operational/infrastructure detail, not something
// other admin roles need or should see.
@ApiTags('server-performance')
@Controller('admin/server-performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class ServerPerformanceController {
  constructor(private readonly serverPerformance: ServerPerformanceService) {}

  // Skips the global throttle — the admin page polls this every few
  // seconds while open, and a 60 req/min budget shared with every other
  // admin route would get exhausted by that alone.
  @Get()
  @SkipThrottle({ default: true })
  getSnapshot() {
    return this.serverPerformance.getSnapshot()
  }
}
