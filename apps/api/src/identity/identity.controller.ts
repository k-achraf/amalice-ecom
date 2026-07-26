import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  @Get('health')
  health() {
    return { module: 'identity', status: 'ok' }
  }
}
