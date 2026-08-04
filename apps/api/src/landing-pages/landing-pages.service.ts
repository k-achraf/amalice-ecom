import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import {
  LandingPageSectionSchema,
  type GenerateLandingPage,
  type LandingPageSection,
  type ProductLandingPage,
  type PublicLandingPage,
  type UpdateLandingPage
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'

@Injectable()
export class LandingPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue('landing-pages') private readonly queue: Queue
  ) {}

  private toView(row: {
    id: string
    productId: string
    slug: string
    name: string
    enabled: boolean
    status: string
    imageProvider: string
    finalImageUrl: string | null
    sections: unknown
    errorMessage: string | null
    createdAt: Date
    updatedAt: Date
  }): ProductLandingPage {
    const sectionsParsed = LandingPageSectionSchema.array().safeParse(row.sections)
    return {
      id: row.id,
      productId: row.productId,
      slug: row.slug,
      name: row.name,
      enabled: row.enabled,
      status: row.status as ProductLandingPage['status'],
      imageProvider: row.imageProvider as ProductLandingPage['imageProvider'],
      finalImageUrl: row.finalImageUrl,
      sections: sectionsParsed.success ? sectionsParsed.data : [],
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }
  }

  // All of a product's landing pages, newest first — the admin "Landing
  // Pages" tab lists these instead of assuming there's only one.
  async list(productId: string): Promise<ProductLandingPage[]> {
    const rows = await this.prisma.productLandingPage.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } })
    return rows.map((r) => this.toView(r))
  }

  async getById(id: string): Promise<ProductLandingPage | null> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    return row ? this.toView(row) : null
  }

  // Turns "Cotton T-Shirt" / a desired custom slug into a unique, URL-safe
  // slug — appends -2, -3, ... on collision. Global uniqueness (not just
  // per-product), since /lp/:slug is one flat namespace.
  private async uniqueSlug(desired: string): Promise<string> {
    const base = desired.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'landing-page'
    let candidate = base
    let n = 2
    while (await this.prisma.productLandingPage.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base}-${n++}`
    }
    return candidate
  }

  // Kicks off generation of a NEW landing page (a create, not an upsert — a
  // product can have several): validates the chosen source images actually
  // belong to this product, resolves a unique slug, seeds a "Generating"
  // row with one placeholder section per requested slot, enqueues the job,
  // and returns immediately — LandingPagesProcessor does the actual AI work
  // and the admin UI polls getById() for progress.
  async generate(productId: string, input: GenerateLandingPage, actor: AuditActor): Promise<ProductLandingPage> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    })
    if (!product) throw new NotFoundException('Product not found')

    const validUrls = new Set(product.images.map((i) => i.url))
    const invalid = input.sourceImageUrls.filter((u) => !validUrls.has(u))
    if (invalid.length > 0) {
      throw new BadRequestException(`These images don't belong to this product: ${invalid.join(', ')}`)
    }

    if (input.slug) {
      const taken = await this.prisma.productLandingPage.findUnique({ where: { slug: input.slug }, select: { id: true } })
      if (taken) throw new BadRequestException(`The URL "/lp/${input.slug}" is already taken — choose another.`)
    }
    const slug = input.slug ?? (await this.uniqueSlug(product.slug))

    const placeholderSections: LandingPageSection[] = Array.from({ length: input.sectionCount }, (_, i) => ({
      id: randomUUID(),
      order: i,
      role: i === 0 ? 'hero' : i === input.sectionCount - 1 ? 'cta' : 'feature',
      headline: '',
      body: '',
      imageUrl: null,
      sourceImageUrls: input.sourceImageUrls,
      status: 'pending'
    }))

    const row = await this.prisma.productLandingPage.create({
      data: {
        productId,
        slug,
        name: input.name ?? 'Landing Page',
        status: 'Generating',
        imageProvider: input.imageProvider,
        sections: placeholderSections as unknown as Prisma.InputJsonValue
      }
    })

    await this.queue.add('generate-full', { landingPageId: row.id, description: input.description, instructions: input.instructions }, { attempts: 1 })

    await this.audit.log({
      actor,
      action: 'Create',
      entity: 'ProductLandingPage',
      entityId: row.id,
      metadata: {
        productId,
        slug,
        sectionCount: input.sectionCount,
        sourceImageCount: input.sourceImageUrls.length,
        imageProvider: input.imageProvider
      }
    })

    return this.toView(row)
  }

  // Regenerates a single section's image in place (reusing its already-
  // drafted copy and source images) — for when one section comes out badly
  // without wanting to redo the whole page.
  async regenerateSection(id: string, sectionId: string, actor: AuditActor, instructions?: string): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Landing page not found')

    const sections = LandingPageSectionSchema.array().parse(row.sections)
    const section = sections.find((s) => s.id === sectionId)
    if (!section) throw new NotFoundException('Section not found')

    const updatedSections = sections.map((s) => (s.id === sectionId ? { ...s, status: 'generating' as const, errorMessage: null } : s))
    const updated = await this.prisma.productLandingPage.update({
      where: { id },
      data: { status: 'Generating', sections: updatedSections as unknown as Prisma.InputJsonValue }
    })

    await this.queue.add('regenerate-section', { landingPageId: id, sectionId, instructions }, { attempts: 1 })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductLandingPage',
      entityId: id,
      metadata: { action: 'regenerate-section', sectionId, ...(instructions && { instructions }) }
    })

    return this.toView(updated)
  }

  // Rename and/or toggle public visibility — either field optional, send
  // whichever changed.
  async update(id: string, input: UpdateLandingPage, actor: AuditActor): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Landing page not found')
    if (input.enabled && row.status !== 'Completed') {
      throw new BadRequestException('Generate this landing page successfully before enabling it.')
    }

    const updated = await this.prisma.productLandingPage.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.enabled !== undefined && { enabled: input.enabled })
      }
    })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductLandingPage',
      entityId: id,
      metadata: {
        ...(input.name !== undefined && { name: { from: row.name, to: input.name } }),
        ...(input.enabled !== undefined && { enabled: { from: row.enabled, to: input.enabled } })
      }
    })

    return this.toView(updated)
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Landing page not found')

    await this.prisma.productLandingPage.delete({ where: { id } })

    await this.audit.log({ actor, action: 'Delete', entity: 'ProductLandingPage', entityId: id, metadata: { slug: row.slug, productId: row.productId } })
  }

  // Public — the storefront's /lp/:slug page fetches this. Only ever
  // returns something for a completed, enabled landing page; no admin/
  // generation internals leak through.
  async getPublicBySlug(slug: string): Promise<PublicLandingPage | null> {
    const row = await this.prisma.productLandingPage.findUnique({
      where: { slug },
      include: { product: { select: { id: true, name: true, slug: true, priceCents: true, imageUrl: true } } }
    })
    if (!row || !row.enabled || row.status !== 'Completed' || !row.finalImageUrl) return null
    return {
      slug: row.slug,
      finalImageUrl: row.finalImageUrl,
      product: row.product
    }
  }
}
