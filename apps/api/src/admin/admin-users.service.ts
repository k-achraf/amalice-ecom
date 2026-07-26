import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import type { CreateAdminUser } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

// ADM-06 — Super Admin user & role management. Deactivating a user blocks
// future logins (AdminAuthService.login checks active); full session
// invalidation on deactivate is SEC-track work (token revocation list).
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list() {
    const users = await this.prisma.adminUser.findMany({
      include: { role: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      roleId: u.roleId,
      roleName: u.role.name,
      active: u.active,
      createdAt: u.createdAt.toISOString()
    }))
  }

  async roles() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } })
  }

  async create(input: CreateAdminUser, actor: AuditActor) {
    const role = await this.prisma.role.findUnique({ where: { id: input.roleId } })
    if (!role) throw new NotFoundException('Role not found')

    const existing = await this.prisma.adminUser.findUnique({ where: { email: input.email } })
    if (existing) throw new ConflictException('An admin with that email already exists')

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.prisma.adminUser.create({
      data: { email: input.email, passwordHash, roleId: input.roleId, active: true }
    })
    await this.audit.log({
      actor,
      action: 'Create',
      entity: 'AdminUser',
      entityId: user.id,
      metadata: { email: user.email, roleName: role.name }
    })
    return { id: user.id, email: user.email, roleId: user.roleId, roleName: role.name, active: true }
  }

  async setActive(id: string, active: boolean, actor: AuditActor) {
    const user = await this.prisma.adminUser.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Admin user not found')
    await this.prisma.adminUser.update({ where: { id }, data: { active } })
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'AdminUser',
      entityId: id,
      metadata: { active }
    })
    return { id, active }
  }
}
