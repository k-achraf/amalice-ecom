import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import {
  LandingPageSectionSchema,
  type GenerateLandingPage,
  type LandingPageSection,
  type ProductLandingPage
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

  async get(productId: string): Promise<ProductLandingPage | null> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { productId } })
    return row ? this.toView(row) : null
  }

  // Kicks off (or restarts) full generation: validates the chosen source
  // images actually belong to this product, seeds a "Generating" row with
  // one placeholder section per requested slot, enqueues the job, and
  // returns immediately — LandingPagesProcessor does the actual AI work and
  // the admin UI polls get() for progress.
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

    const row = await this.prisma.productLandingPage.upsert({
      where: { productId },
      update: {
        status: 'Generating',
        imageProvider: input.imageProvider,
        finalImageUrl: null,
        sections: placeholderSections as unknown as Prisma.InputJsonValue,
        errorMessage: null
      },
      create: {
        productId,
        status: 'Generating',
        imageProvider: input.imageProvider,
        sections: placeholderSections as unknown as Prisma.InputJsonValue
      }
    })

    await this.queue.add('generate-full', { landingPageId: row.id, description: input.description }, { attempts: 1 })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductLandingPage',
      entityId: row.id,
      metadata: {
        action: 'generate',
        productId,
        sectionCount: input.sectionCount,
        sourceImageCount: input.sourceImageUrls.length,
        imageProvider: input.imageProvider
      }
    })

    return this.toView(row)
  }

  // Regenerates a single section's image in place (reusing its already-
  // drafted copy and source images) — for when one section comes out badly
  // without wanting to redo the whole product.
  async regenerateSection(productId: string, sectionId: string, actor: AuditActor): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { productId } })
    if (!row) throw new NotFoundException('No landing page generated for this product yet')

    const sections = LandingPageSectionSchema.array().parse(row.sections)
    const section = sections.find((s) => s.id === sectionId)
    if (!section) throw new NotFoundException('Section not found')

    const updatedSections = sections.map((s) => (s.id === sectionId ? { ...s, status: 'generating' as const, errorMessage: null } : s))
    const updated = await this.prisma.productLandingPage.update({
      where: { productId },
      data: { status: 'Generating', sections: updatedSections as unknown as Prisma.InputJsonValue }
    })

    await this.queue.add('regenerate-section', { landingPageId: row.id, sectionId }, { attempts: 1 })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductLandingPage',
      entityId: row.id,
      metadata: { action: 'regenerate-section', productId, sectionId }
    })

    return this.toView(updated)
  }

  // Toggle only — whether the storefront PDP shows the generated image.
  // Independent of the generation pipeline; can be flipped any time a
  // completed image exists.
  async setEnabled(productId: string, enabled: boolean, actor: AuditActor): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { productId } })
    if (!row) throw new NotFoundException('No landing page generated for this product yet')
    if (enabled && row.status !== 'Completed') {
      throw new BadRequestException('Generate a landing page successfully before enabling it on the storefront.')
    }

    const updated = await this.prisma.productLandingPage.update({ where: { productId }, data: { enabled } })

    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'ProductLandingPage',
      entityId: row.id,
      metadata: { enabled: { from: row.enabled, to: enabled } }
    })

    return this.toView(updated)
  }
}
