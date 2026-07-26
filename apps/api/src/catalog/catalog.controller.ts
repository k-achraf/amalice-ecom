import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  @Get('health')
  health() {
    return { module: 'catalog', status: 'ok' }
  }
}
