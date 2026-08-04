import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url().default('postgresql://amalice:amalice_dev@localhost:5433/amalice'),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  // This API's own public URL — needed to construct URLs an outside party
  // must call (currently: the DHD webhook URL shown in Settings → Shipping
  // Companies, since DHD's platform needs the full https://... address to
  // configure, not a relative path). Not used for anything internal, so a
  // wrong value only breaks that one displayed URL, not the API itself.
  PUBLIC_API_URL: z.string().default('http://localhost:3333'),
  // No code-level defaults for secrets — that's how a placeholder value
  // quietly ends up in production. Dev-only values live in .env.example.
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // AI landing page builder (packages/shared/src/landing-page.ts) — a free
  // key from aistudio.google.com. Optional: the feature degrades to a clear
  // "not configured" error rather than the whole API failing to boot, since
  // it's an opt-in content tool, not core platform infrastructure.
  GEMINI_API_KEY: z.string().min(1).optional(),
  // Google Sheets integration (apps/api/src/apps/google-sheets-client.service.ts)
  // — a service account's credentials, shared globally across every
  // connected sheet (one Amalice backend, not one per store). Both optional
  // together: the feature just no-ops (order pushes/status updates silently
  // skip) rather than failing checkout when unset. Get these from a Google
  // Cloud service account JSON key: CLIENT_EMAIL is `client_email`,
  // PRIVATE_KEY is `private_key` (keep its literal \n escapes as-is — the
  // client unescapes them at read time).
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().min(1).optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().min(1).optional()
})

export type Env = z.infer<typeof envSchema>

// Passed to ConfigModule.forRoot({ validate }) — Nest calls this at bootstrap
// and crashes with the thrown error on invalid config, rather than
// surfacing a confusing failure three requests into a broken deploy.
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
