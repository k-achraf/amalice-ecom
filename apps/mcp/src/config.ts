import { z } from 'zod'

// The server holds no secrets: each AI client brings its own token (created in the admin under
// Settings -> AI agents), which is forwarded to the API. The API decides what that token may do.
const EnvSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(3004),
  MCP_HOST: z.string().default('127.0.0.1'),
  API_BASE_URL: z.string().url().default('http://localhost:3333')
})

export interface Config {
  port: number
  host: string
  apiBase: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env)
  return { port: parsed.MCP_PORT, host: parsed.MCP_HOST, apiBase: parsed.API_BASE_URL.replace(/\/$/, '') }
}
