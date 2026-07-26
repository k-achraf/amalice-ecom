import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AdminRoleName } from '../../generated/prisma/client'
import { ROLES_KEY } from './roles.decorator'

// Proves the mechanism works on one route (FND-08). Applying this
// consistently across every admin-facing module, matched against the role
// table in cod-platform-plan.md §8, is SEC-01 — not attempted here.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRoleName[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (!requiredRoles || requiredRoles.length === 0) return true

    const { user } = context.switchToHttp().getRequest<{ user?: { role: AdminRoleName } }>()
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Requires one of role(s): ${requiredRoles.join(', ')}`)
    }
    return true
  }
}
