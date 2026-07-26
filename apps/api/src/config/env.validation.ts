import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.url().default('postgresql://amalice:amalice_dev@localhost:5433/amalice'),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  // No code-level defaults for secrets — that's how a placeholder value
  // quietly ends up in production. Dev-only values live in .env.example.
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OTP_SECRET: z.string().min(32),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300)
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
