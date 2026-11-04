import { createHash, randomBytes } from 'node:crypto'
import { Injectable, NotFoundException } from '@nestjs/common'
import { MCP_TOKEN_PREFIX, type CreateMcpToken, type CreatedMcpToken, type McpAbility, type McpTokenSummary, type UpdateMcpToken } from '@amalice/shared'
import type { McpToken } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'
import { PrismaService } from '../prisma/prisma.service'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
// Do not write lastUsedAt on every single request.
const LAST_USED_GRANULARITY_MS = 60_000

function toSummary(t: McpToken): McpTokenSummary {
  return {
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    abilities: t.abilities as McpAbility[],
    createdByEmail: t.createdByEmail,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt?.toISOString() ?? null,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null
  }
}

@Injectable()
export class McpTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(): Promise<McpTokenSummary[]> {
    const rows = await this.prisma.mcpToken.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(toSummary)
  }

  // The plaintext token exists only in this return value; only its hash is stored.
  async create(input: CreateMcpToken, actor: AuditActor): Promise<CreatedMcpToken> {
    const token = MCP_TOKEN_PREFIX + randomBytes(32).toString('base64url')
    const row = await this.prisma.mcpToken.create({
      data: {
        name: input.name,
        tokenHash: sha256(token),
        prefix: token.slice(0, 8),
        abilities: [...new Set(input.abilities)],
        createdById: actor.id,
        createdByEmail: actor.email,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'McpToken', entityId: row.id, metadata: { name: row.name, abilities: row.abilities } })
    return { ...toSummary(row), token }
  }

  async update(id: string, input: UpdateMcpToken, actor: AuditActor): Promise<McpTokenSummary> {
    await this.mustFind(id)
    const row = await this.prisma.mcpToken.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.abilities !== undefined && { abilities: [...new Set(input.abilities)] }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null })
      }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'McpToken', entityId: id, metadata: input })
    return toSummary(row)
  }

  async revoke(id: string, actor: AuditActor): Promise<McpTokenSummary> {
    const existing = await this.mustFind(id)
    if (existing.revokedAt) return toSummary(existing)
    const row = await this.prisma.mcpToken.update({ where: { id }, data: { revokedAt: new Date() } })
    await this.audit.log({ actor, action: 'Update', entity: 'McpToken', entityId: id, metadata: { revoked: true } })
    return toSummary(row)
  }

  async remove(id: string, actor: AuditActor): Promise<{ ok: true }> {
    const existing = await this.mustFind(id)
    await this.prisma.mcpToken.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'McpToken', entityId: id, metadata: { name: existing.name } })
    return { ok: true }
  }

  // Resolves a presented token to its row, or null if unknown / revoked / expired.
  async verify(presented: string): Promise<McpToken | null> {
    const row = await this.prisma.mcpToken.findUnique({ where: { tokenHash: sha256(presented) } })
    if (!row || row.revokedAt) return null
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS) {
      void this.prisma.mcpToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined)
    }
    return row
  }

  private async mustFind(id: string): Promise<McpToken> {
    const row = await this.prisma.mcpToken.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Token not found')
    return row
  }
}
