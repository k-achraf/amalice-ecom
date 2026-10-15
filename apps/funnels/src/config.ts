import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Node's built-in .env loader (no dotenv dependency). Missing file is fine: everything has a default.
const envFile = join(__dirname, '..', '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const trimSlash = (s: string) => s.replace(/\/+$/, '')

export const config = {
  port: Number(process.env.PORT ?? 3002),
  // Server-to-server (this process → API).
  apiBase: trimSlash(process.env.API_BASE ?? 'http://localhost:3333'),
  // Browser → API (order submit, communes, analytics).
  publicApiBase: trimSlash(process.env.PUBLIC_API_BASE ?? process.env.API_BASE ?? 'http://localhost:3333'),
  // Fresh window. After this a page is "stale": still served instantly, refreshed in the background.
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? 30_000),
  // Beyond this a stale page is too old to serve and the visitor waits for a fresh one.
  maxStaleMs: 10 * 60_000,
  // How long "no such funnel" is remembered, so a bad URL can't hammer the API.
  notFoundTtlMs: 10_000
}
