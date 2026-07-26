import { Injectable } from '@nestjs/common'
import type { AuditAction } from '@amalice/shared'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

// SEC-03 — the one place every audit-logged mutation writes through. Used by
// the admin order/product/reconciliation services. The append-only AuditLog
// table has no delete path anywhere (ADM-08 is read-only); this service only
// appends. Actor is the admin user from the JWT (id + email), nullable for
// system events.
export interface AuditActor {
  id: string
  email: string
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(args: {
    actor?: AuditActor | null
    action: AuditAction
    entity: string
    entityId: string
    metadata?: unknown
  }) {
    // Prisma's JSON null is a sentinel (Prisma.JsonNull), not a plain null —
    // a NullableJson field distinguishes "set to null" from "field omitted."
    const metadata = args.metadata === undefined || args.metadata === null ? Prisma.JsonNull : (args.metadata as object)
    return this.prisma.auditLog.create({
      data: {
        actorId: args.actor?.id ?? null,
        actorEmail: args.actor?.email ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId,
        metadata
      }
    })
  }

  // ADM-08 — read-only list with filters. Never exposes a delete/update.
  list(args: { entity?: string; actorId?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const where = {
      ...(args.entity && { entity: args.entity }),
      ...(args.actorId && { actorId: args.actorId }),
      ...(args.from || args.to) && {
        createdAt: { ...(args.from && { gte: args.from }), ...(args.to && { lte: args.to }) }
      }
    }
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]).then(([items, total]) => ({ items, total, page: args.page, pageSize: args.pageSize }))
  }
}
