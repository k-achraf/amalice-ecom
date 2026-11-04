import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

// Two ways in: an admin JWT, or an AI-agent token (strategy 'mcp-token', see src/mcp) whose
// abilities are enforced inside that strategy. The JWT strategy runs first and simply fails on
// an agent token, which falls through to the second.
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'mcp-token']) {}
