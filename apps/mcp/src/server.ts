import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { MCP_TOKEN_PREFIX, type McpSelf } from '@amalice/shared'
import { AmaliceApi, ApiError } from './api.js'
import { loadConfig } from './config.js'
import { registerAllTools } from './tools/index.js'
import { gate } from './tools/abilities.js'

const config = loadConfig()
const MAX_BODY_BYTES = 1_000_000
// How long a token's abilities are trusted before asking the API again. Revoking or editing a
// token therefore takes effect here within this window (the API itself checks every call live).
const SELF_TTL_MS = 30_000

const selfCache = new Map<string, { at: number; self: McpSelf }>()

async function resolveSelf(api: AmaliceApi, token: string): Promise<McpSelf | null> {
  const hit = selfCache.get(token)
  if (hit && Date.now() - hit.at < SELF_TTL_MS) return hit.self
  try {
    const self = await api.get<McpSelf>('/mcp/self')
    selfCache.set(token, { at: Date.now(), self })
    if (selfCache.size > 500) selfCache.delete(selfCache.keys().next().value as string)
    return self
  } catch (e) {
    selfCache.delete(token)
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null
    throw e
  }
}

function bearerOf(req: IncomingMessage): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')
  const token = match?.[1]?.trim()
  return token && token.startsWith(MCP_TOKEN_PREFIX) ? token : null
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error('payload too large')
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : undefined
}

function buildServer(api: AmaliceApi, self: McpSelf): McpServer {
  const server = new McpServer(
    { name: 'amalice', version: '0.2.0' },
    {
      instructions:
        'Amalice is a cash-on-delivery (COD) e-commerce platform for Algeria. Money amounts are in cents (DA x 100) unless a field says otherwise. ' +
        'Orders move through a state machine (PendingCallCenter -> Confirmed -> Packed -> HandedToCourier -> Delivered ...); the API rejects illegal moves. ' +
        `You are connected as "${self.name}" with these abilities: ${self.abilities.join(', ') || 'none'}. ` +
        'Use the dedicated tools first; for anything else use find_api_endpoints then call_api. ' +
        'Write tools change real orders, stock and shipments: read first, do exactly what the user asked, and report what you changed. New products are created hidden; the owner publishes them.'
    }
  )
  registerAllTools({ server: gate(server, self.abilities), api, abilities: self.abilities })
  return server
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (url.pathname === '/health') return send(res, 200, { ok: true })
  if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found' })

  const token = bearerOf(req)
  if (!token) {
    res.setHeader('www-authenticate', 'Bearer realm="amalice-mcp"')
    return send(res, 401, { error: 'unauthorized' })
  }

  // Stateless mode: every POST is a self-contained request, so there is no
  // server-side session to lose on a restart or to pin to one PM2 worker.
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST')
    return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null })
  }

  try {
    const api = new AmaliceApi(config.apiBase, token)
    const self = await resolveSelf(api, token)
    if (!self) {
      res.setHeader('www-authenticate', 'Bearer realm="amalice-mcp", error="invalid_token"')
      return send(res, 401, { error: 'invalid, revoked or expired token' })
    }

    const body = await readJson(req)
    const server = buildServer(api, self)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, body)
    console.log(`[mcp] ${self.name} ${(body as { method?: string } | undefined)?.method ?? '?'}`)
  } catch (err) {
    console.error('[mcp] request failed:', err instanceof Error ? err.message : err)
    if (!res.headersSent) send(res, 502, { jsonrpc: '2.0', error: { code: -32603, message: 'Upstream API unavailable' }, id: null })
  }
})

http.listen(config.port, config.host, () => {
  console.log(`[mcp] listening on http://${config.host}:${config.port}/mcp -> ${config.apiBase}`)
})
