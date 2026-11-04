import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AmaliceApi } from '../api.js'
import { ApiError } from '../api.js'

export interface ToolContext {
  server: McpServer
  api: AmaliceApi
  // The abilities ("orders:read", ...) this token was granted.
  abilities: readonly string[]
}

// Responses are capped so a huge list can never flood the model's context.
const MAX_CHARS = 60_000

export function ok(data: unknown) {
  let text = JSON.stringify(data, null, 1)
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + `\n…[truncated ${text.length - MAX_CHARS} chars — narrow the filters or lower pageSize]`
  }
  return { content: [{ type: 'text' as const, text }] }
}

export function fail(err: unknown) {
  const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err)
  return { isError: true, content: [{ type: 'text' as const, text: message }] }
}

// Wraps a handler so API errors become tool errors the model can read and react to.
export function safe<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args))
    } catch (e) {
      return fail(e)
    }
  }
}
