import { z } from 'zod'

// Fails fast at boot on a misconfigured environment, rather than surfacing
// as a confusing runtime error three requests into a broken API call.
const envSchema = z.object({
  NUXT_PUBLIC_API_BASE: z.url().default('http://localhost:3333')
})

export default defineNitroPlugin(() => {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment configuration:', z.treeifyError(result.error))
    process.exit(1)
  }
})
