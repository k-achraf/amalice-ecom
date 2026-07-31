import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreateWholesaler, UpdateWholesaler, WholesalerView } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

@Injectable()
export class WholesalersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private toView(row: Awaited<ReturnType<typeof this.prisma.wholesaler.findFirstOrThrow>> & { _count?: { sourcingRequests: number } }): WholesalerView {
    return {
      id: row.id,
      name: row.name,
      country: row.country,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      website: row.website,
      notes: row.notes,
      requestCount: row._count?.sourcingRequests ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  async list(): Promise<WholesalerView[]> {
    const rows = await this.prisma.wholesaler.findMany({
      include: { _count: { select: { sourcingRequests: true } } },
      orderBy: { name: 'asc' }
    })
    return rows.map((r) => this.toView(r))
  }

  async create(input: CreateWholesaler, actor: AuditActor): Promise<WholesalerView> {
    const row = await this.prisma.wholesaler.create({ data: input, include: { _count: { select: { sourcingRequests: true } } } })
    await this.audit.log({ actor, action: 'Create', entity: 'Wholesaler', entityId: row.id, metadata: input })
    return this.toView(row)
  }

  async update(id: string, input: UpdateWholesaler, actor: AuditActor): Promise<WholesalerView> {
    await this.ensureExists(id)
    const row = await this.prisma.wholesaler.update({
      where: { id },
      data: input,
      include: { _count: { select: { sourcingRequests: true } } }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'Wholesaler', entityId: id, metadata: input })
    return this.toView(row)
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.ensureExists(id)
    await this.prisma.wholesaler.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'Wholesaler', entityId: id })
  }

  private async ensureExists(id: string) {
    const row = await this.prisma.wholesaler.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Wholesaler not found')
    return row
  }
}
