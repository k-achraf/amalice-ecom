import { Module } from '@nestjs/common'
import { ServerPerformanceController } from './server-performance.controller'
import { ServerPerformanceService } from './server-performance.service'

@Module({
  controllers: [ServerPerformanceController],
  providers: [ServerPerformanceService]
})
export class ServerPerformanceModule {}
