import { SetMetadata } from '@nestjs/common'
import type { AdminRoleName } from '../../generated/prisma/client'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: AdminRoleName[]) => SetMetadata(ROLES_KEY, roles)
