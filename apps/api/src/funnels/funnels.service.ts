import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  FUNNEL_STEP_TYPE_META,
  getFunnelTemplate,
  type CreateFunnel,
  type CreateFunnelStep,
  type FunnelDetail,
  type FunnelListItem,
  type FunnelStepConfig,
  type FunnelStepType,
  type FunnelStepView,
  type ReorderFunnelSteps,
  type UpdateFunnel,
  type UpdateFunnelStep
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'

const OFFER_TYPES: FunnelStepType[] = ['Upsell', 'Downsell', 'OrderBump']

const productSelect = { id: true, name: true, slug: true, imageUrl: true } as const

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return base || 'funnel'
}

type StepRow = {
  id: string
  funnelId: string
  position: number
  type: string
  name: string
  enabled: boolean
  config: unknown
}

type FunnelRow = {
  id: string
  name: string
  slug: string
  status: string
  templateId: string
  createdAt: Date
  updatedAt: Date
  product: { id: string; name: string; slug: string; imageUrl: string | null }
}

function toListItem(row: FunnelRow, stepCount: number): FunnelListItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as FunnelListItem['status'],
    templateId: row.templateId,
    product: row.product,
    stepCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

@Injectable()
export class FunnelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(): Promise<FunnelListItem[]> {
    const rows = await this.prisma.funnel.findMany({
      orderBy: { createdAt: 'desc' },
      include: { product: { select: productSelect }, _count: { select: { steps: true } } }
    })
    return rows.map((r) => toListItem(r, r._count.steps))
  }

  async get(id: string): Promise<FunnelDetail> {
    const row = await this.prisma.funnel.findUnique({
      where: { id },
      include: { product: { select: productSelect }, steps: { orderBy: { position: 'asc' } } }
    })
    if (!row) throw new NotFoundException('Funnel not found')
    return this.toDetail(row, row.steps)
  }

  async create(input: CreateFunnel, actor: AuditActor): Promise<FunnelDetail> {
    const template = getFunnelTemplate(input.templateId)
    if (!template) throw new BadRequestException('Unknown funnel template')
    await this.ensureProduct(input.productId)
    if (input.slug) await this.assertSlugFree(input.slug)
    const slug = input.slug ?? (await this.uniqueSlug(slugify(input.name)))

    const row = await this.prisma.funnel.create({
      data: {
        name: input.name,
        slug,
        templateId: template.id,
        productId: input.productId,
        steps: {
          create: template.steps.map((s, position) => ({ position, type: s.type, name: s.name, config: {} }))
        }
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'Funnel', entityId: row.id, metadata: { name: input.name, templateId: template.id } })
    return this.get(row.id)
  }

  async update(id: string, input: UpdateFunnel, actor: AuditActor): Promise<FunnelDetail> {
    await this.ensureFunnel(id)
    if (input.productId) await this.ensureProduct(input.productId)
    if (input.slug) await this.assertSlugFree(input.slug, id)
    await this.prisma.funnel.update({ where: { id }, data: input })
    await this.audit.log({ actor, action: 'Update', entity: 'Funnel', entityId: id, metadata: input })
    return this.get(id)
  }

  async remove(id: string, actor: AuditActor): Promise<{ ok: true }> {
    await this.ensureFunnel(id)
    await this.prisma.funnel.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'Funnel', entityId: id })
    return { ok: true }
  }

  async duplicate(id: string, actor: AuditActor): Promise<FunnelDetail> {
    const src = await this.get(id)
    const slug = await this.uniqueSlug(`${src.slug}-copy`)
    const row = await this.prisma.funnel.create({
      data: {
        name: `${src.name} (copy)`,
        slug,
        templateId: src.templateId,
        productId: src.product.id,
        steps: {
          create: src.steps.map((s) => ({ position: s.position, type: s.type, name: s.name, enabled: s.enabled, config: s.config as object }))
        }
      }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'Funnel', entityId: row.id, metadata: { duplicatedFrom: id } })
    return this.get(row.id)
  }

  // ---- steps ----

  async addStep(funnelId: string, input: CreateFunnelStep, actor: AuditActor): Promise<FunnelDetail> {
    await this.ensureFunnel(funnelId)
    const steps = await this.prisma.funnelStep.findMany({ where: { funnelId }, orderBy: { position: 'asc' } })
    // Keep a ThankYou step last: new steps slot in before it.
    const tail = steps.at(-1)
    const thankYou = tail?.type === 'ThankYou' && input.type !== 'ThankYou' ? tail : undefined
    const position = thankYou ? thankYou.position : steps.length
    if (thankYou) {
      await this.prisma.funnelStep.update({ where: { id: thankYou.id }, data: { position: position + 1 } })
    }
    const row = await this.prisma.funnelStep.create({
      data: { funnelId, position, type: input.type, name: input.name ?? FUNNEL_STEP_TYPE_META[input.type].label, config: {} }
    })
    await this.audit.log({ actor, action: 'Create', entity: 'FunnelStep', entityId: row.id, metadata: { funnelId, type: input.type } })
    return this.get(funnelId)
  }

  async updateStep(funnelId: string, stepId: string, input: UpdateFunnelStep, actor: AuditActor): Promise<FunnelDetail> {
    const step = await this.ensureStep(funnelId, stepId)
    if (input.config) {
      const pointsAtOffer = !!input.config.offerProductId || input.config.priceCentsOverride != null
      if (pointsAtOffer && !OFFER_TYPES.includes(step.type as FunnelStepType)) {
        throw new BadRequestException('Only upsell, downsell and order-bump steps can point at an offer product')
      }
      if (input.config.offerProductId) await this.ensureProduct(input.config.offerProductId)
      if (input.config.landing) {
        if (step.type !== 'Landing') throw new BadRequestException('Only landing-page steps have landing settings')
        const pageId = input.config.landing.generatedPageId
        if (pageId) {
          const funnel = await this.prisma.funnel.findUnique({ where: { id: funnelId }, select: { productId: true } })
          const page = await this.prisma.productLandingPage.findFirst({ where: { id: pageId, productId: funnel?.productId } })
          if (!page) throw new BadRequestException('That generated landing page does not belong to the funnel’s product')
        }
      }
    }
    await this.prisma.funnelStep.update({
      where: { id: stepId },
      data: { name: input.name, enabled: input.enabled, config: input.config ? (input.config as object) : undefined }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'FunnelStep', entityId: stepId, metadata: input })
    return this.get(funnelId)
  }

  async removeStep(funnelId: string, stepId: string, actor: AuditActor): Promise<FunnelDetail> {
    await this.ensureStep(funnelId, stepId)
    await this.prisma.$transaction(async (tx) => {
      await tx.funnelStep.delete({ where: { id: stepId } })
      const rest = await tx.funnelStep.findMany({ where: { funnelId }, orderBy: { position: 'asc' } })
      for (const [position, s] of rest.entries()) {
        if (s.position !== position) await tx.funnelStep.update({ where: { id: s.id }, data: { position } })
      }
    })
    await this.audit.log({ actor, action: 'Delete', entity: 'FunnelStep', entityId: stepId, metadata: { funnelId } })
    return this.get(funnelId)
  }

  async reorder(funnelId: string, input: ReorderFunnelSteps, actor: AuditActor): Promise<FunnelDetail> {
    await this.ensureFunnel(funnelId)
    const existing = await this.prisma.funnelStep.findMany({ where: { funnelId }, select: { id: true } })
    const ids = new Set(existing.map((s) => s.id))
    if (input.stepIds.length !== ids.size || input.stepIds.some((id) => !ids.has(id)) || new Set(input.stepIds).size !== ids.size) {
      throw new BadRequestException('stepIds must list every step of this funnel exactly once')
    }
    await this.prisma.$transaction(
      input.stepIds.map((id, position) => this.prisma.funnelStep.update({ where: { id }, data: { position } }))
    )
    await this.audit.log({ actor, action: 'Update', entity: 'Funnel', entityId: funnelId, metadata: { reorder: input.stepIds } })
    return this.get(funnelId)
  }

  // ---- helpers ----

  private async toDetail(row: FunnelRow, steps: StepRow[]): Promise<FunnelDetail> {
    const offerIds = steps
      .map((s) => (s.config as FunnelStepConfig | null)?.offerProductId)
      .filter((v): v is string => !!v)
    const products = offerIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: offerIds } }, select: { id: true, name: true, imageUrl: true, priceCents: true } })
      : []
    const byId = new Map(products.map((p) => [p.id, p]))
    const stepViews: FunnelStepView[] = steps.map((s) => {
      const config = (s.config ?? {}) as FunnelStepConfig
      return {
        id: s.id,
        funnelId: s.funnelId,
        position: s.position,
        type: s.type as FunnelStepType,
        name: s.name,
        enabled: s.enabled,
        config,
        offerProduct: config.offerProductId ? (byId.get(config.offerProductId) ?? null) : null
      }
    })
    return { ...toListItem(row, steps.length), steps: stepViews }
  }

  private async ensureFunnel(id: string) {
    const f = await this.prisma.funnel.findUnique({ where: { id }, select: { id: true } })
    if (!f) throw new NotFoundException('Funnel not found')
  }

  private async ensureStep(funnelId: string, stepId: string) {
    const s = await this.prisma.funnelStep.findFirst({ where: { id: stepId, funnelId } })
    if (!s) throw new NotFoundException('Funnel step not found')
    return s
  }

  private async ensureProduct(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } })
    if (!p) throw new BadRequestException('Product not found')
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const hit = await this.prisma.funnel.findUnique({ where: { slug }, select: { id: true } })
    if (hit && hit.id !== exceptId) throw new ConflictException('A funnel with this slug already exists')
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base
    for (let i = 2; await this.prisma.funnel.findUnique({ where: { slug }, select: { id: true } }); i++) {
      slug = `${base}-${i}`
    }
    return slug
  }
}
