import { z } from 'zod'

// The five admin roles from cod-platform-plan.md §8 — kept in sync with the
// Prisma AdminRoleName enum by hand. Exported here so both the API and the
// admin app share one role type (the admin's nav-filtering + RBAC meta uses
// this; the server's RolesGuard uses the Prisma enum).
export const AdminRoleNameSchema = z.enum(['SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse'])
export type AdminRoleName = z.infer<typeof AdminRoleNameSchema>

export const AdminLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
})
export type AdminLogin = z.infer<typeof AdminLoginSchema>

export const AdminRefreshSchema = z.object({
  refreshToken: z.string().min(1)
})
export type AdminRefresh = z.infer<typeof AdminRefreshSchema>
