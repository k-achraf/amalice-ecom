import { z } from 'zod'

// The admin roles from cod-platform-plan.md §8 (plus CallCenterAgent, added
// later) — kept in sync with the Prisma AdminRoleName enum by hand. Exported
// here so both the API and the admin app share one role type (the admin's
// nav-filtering + RBAC meta uses this; the server's RolesGuard uses the
// Prisma enum).
//
// CallCenterAgent is deliberately narrower than Support: Support is a
// broader "customer support" role with access to the full Orders list and
// Customers directory (unmasked phone); CallCenterAgent is scoped to just
// the confirmation-call workflow — the Call Center queue + Drop Queue pages,
// and (via those pages' own links) an individual order's detail — nothing
// else. See apps/admin/app/layouts/default.vue's nav filter and
// apps/api/src/admin/admin.controller.ts's @Roles() lists for where the
// actual access boundary is drawn.
export const AdminRoleNameSchema = z.enum(['SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse', 'CallCenterAgent'])
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
