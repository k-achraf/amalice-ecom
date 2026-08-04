import { z } from 'zod'

// Operational error/warning logs — see ServerLog's Prisma comment for how
// this differs from AuditLog (business events vs. `Logger.warn/error()`
// calls anywhere in the API). Admin-only, SuperAdmin-gated (same as Server
// Performance) since this is infrastructure detail, not something every
// admin role needs.
export const ServerLogLevelSchema = z.enum(['Warn', 'Error'])
export type ServerLogLevel = z.infer<typeof ServerLogLevelSchema>

export const ServerLogItemSchema = z.object({
  id: z.uuid(),
  level: ServerLogLevelSchema,
  context: z.string().nullable(),
  message: z.string(),
  trace: z.string().nullable(),
  createdAt: z.string()
})
export type ServerLogItem = z.infer<typeof ServerLogItemSchema>

export const ServerLogResponseSchema = z.object({
  items: z.array(ServerLogItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive()
})
export type ServerLogResponse = z.infer<typeof ServerLogResponseSchema>
