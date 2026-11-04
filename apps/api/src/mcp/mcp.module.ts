import { Module } from '@nestjs/common'
import { McpEndpointCatalog } from './mcp-endpoint-catalog.service'
import { McpTokenStrategy } from './mcp-token.strategy'
import { McpSelfController, McpTokensController } from './mcp-tokens.controller'
import { McpTokensService } from './mcp-tokens.service'

@Module({
  controllers: [McpTokensController, McpSelfController],
  providers: [McpTokensService, McpTokenStrategy, McpEndpointCatalog],
  exports: [McpEndpointCatalog]
})
export class McpModule {}
