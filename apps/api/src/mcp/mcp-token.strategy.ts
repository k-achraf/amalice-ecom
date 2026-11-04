import { ForbiddenException, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { MCP_TOKEN_PREFIX, authorizeMcpRequest, type McpAbility } from '@amalice/shared'
import { McpTokensService } from './mcp-tokens.service'

// What request.user is for an AI-agent token. role is SuperAdmin only so the existing
// @Roles checks let the request reach the handler; the real limit is the token abilities,
// checked right here against the request path and method BEFORE the handler runs
// (default deny: unmapped paths, /auth and /admin/mcp-tokens are all refused).
// sub is the token id, so audit rows read "mcp:<name>".
export interface McpPrincipal {
  sub: string
  id: string
  email: string
  role: 'SuperAdmin'
  mcp: { name: string; abilities: McpAbility[] }
}

// passport ships without types here and is only used to register the strategy.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const passport: { use(name: string, strategy: unknown): void } = require('passport')

type Callbacks = {
  success: (user: McpPrincipal) => void
  fail: (challenge?: unknown, status?: number) => void
  error: (err: Error) => void
}

const BEARER = new RegExp(`^Bearer\\s+(${MCP_TOKEN_PREFIX}[A-Za-z0-9_-]{20,})$`)

// A raw passport strategy (not the PassportStrategy mixin): the verify callback shape does not
// give both the token and the request path, and this needs both.
@Injectable()
export class McpTokenStrategy {
  readonly name = 'mcp-token'

  constructor(private readonly tokens: McpTokensService) {
    passport.use(this.name, this)
  }

  authenticate(this: McpTokenStrategy & Callbacks, req: Request) {
    const match = BEARER.exec(req.headers.authorization ?? '')
    // Not an agent token: let the next strategy (the admin JWT) have a go.
    if (!match) return this.fail()

    this.tokens
      .verify(match[1] as string)
      .then((row) => {
        if (!row) return this.fail({ message: 'Invalid, revoked or expired token' }, 401)
        const abilities = row.abilities as McpAbility[]
        const decision = authorizeMcpRequest(abilities, req.method, req.originalUrl)
        if (!decision.ok) return this.error(new ForbiddenException(decision.reason))
        this.success({ sub: row.id, id: row.id, email: `mcp:${row.name}`, role: 'SuperAdmin', mcp: { name: row.name, abilities } })
      })
      .catch((e: unknown) => this.error(e instanceof Error ? e : new Error(String(e))))
  }
}
