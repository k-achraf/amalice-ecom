import type { AdminRoleName } from '../../generated/prisma/client'

export interface AdminJwtPayload {
  sub: string
  email: string
  role: AdminRoleName
}
