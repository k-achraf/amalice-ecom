import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import {
  LandingDesignSchema,
  LandingPageSectionSchema,
  type GenerateLandingCopy,
  type GeneratedLandingCopy,
  type UpdateLandingPageDesign,
  type UpdateLandingPageSection,
  type GenerateLandingPage,
  type ImproveLandingPageDescription,
  type ImprovedLandingPageDescription,
  type LandingPageSection,
  type ProductLandingPage,
  type PublicLandingPage,
  type UpdateLandingPage
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GeminiService } from './gemini.service'
import { LandingComposerService } from './landing-composer.service'
import { sanitizeText } from './landing-copy.util'

// Spreads the store owner's selected product photos across sections — each
// section gets only 1 or 2 of them, never the whole set. Previously every
// section was handed ALL selected images (see this file's git history), so
// a 7-image/7-section landing page sent Gemini 7 reference photos per
// section-image call with no indication of which one to actually feature;
// the model would arbitrarily latch onto just one (sometimes the same one
// every time), which is exactly the "only one image gets used" bug this
// exists to fix — a request with fewer, section-specific reference photos
// makes it far more likely the model uses all of what it's given.
// Round-robins every image across sections' first slot, then every
// section's second slot, capped at 2 slots/section — so with imageCount <=
// 2 * sectionCount (the common case, e.g. 7 images / 7 sections) every
// selected image ends up used in at least one section. If imageCount
// exceeds that cap, the earliest-selected images win and the rest simply
// don't get a dedicated section — a store owner picking far more images
// than sections is the only case that happens in.
export function distributeSourceImages(imageUrls: string[], sectionCount: number): string[][] {
  if (sectionCount === 0) return []
  if (imageUrls.length === 0) return Array.from({ length: sectionCount }, () => [])

  const perSection: string[][] = Array.from({ length: sectionCount }, () => [])
  const totalSlots = sectionCount * 2
  const slotCount = Math.min(Math.max(imageUrls.length, sectionCount), totalSlots)
  for (let i = 0; i < slotCount; i++) {
    perSection[i % sectionCount].push(imageUrls[i % imageUrls.length]!)
  }
  return perSection.map((urls) => [...new Set(urls)])
}

@Injectable()
export class LandingPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue('landing-pages') private readonly queue: Queue,
    private readonly gemini: GeminiService,
    private readonly composer: LandingComposerService
  ) {}

  // "Improve with AI" on the generation form's "description to generate
  // from" field — pure text in/out (see GeminiService.
  // improveLandingPageDescription), no Prisma read/write at all. No landing
  // page needs to exist yet: this runs during the compose step, before
  // "Generate landing page" is clicked, and never touches Product.
  // description or any other product content.
  async improveDescription(input: ImproveLandingPageDescription): Promise<ImprovedLandingPageDescription> {
    const text = await this.gemini.improveLandingPageDescription(input)
    return { text }
  }

  private toView(row: {
    id: string
    productId: string
    number: number
    name: string
    enabled: boolean
    status: string
    imageProvider: string
    finalImageUrl: string | null
    sections: unknown
    design: unknown
    errorMessage: string | null
    createdAt: Date
    updatedAt: Date
  }): ProductLandingPage {
    const sectionsParsed = LandingPageSectionSchema.array().safeParse(row.sections)
    return {
      id: row.id,
      productId: row.productId,
      number: row.number,
      name: row.name,
      enabled: row.enabled,
      status: row.status as ProductLandingPage['status'],
      imageProvider: row.imageProvider as ProductLandingPage['imageProvider'],
      finalImageUrl: row.finalImageUrl,
      sections: sectionsParsed.success ? sectionsParsed.data : [],
      design: LandingDesignSchema.parse(row.design ?? {}),
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

  // Next sequential number for this product's landing pages (1, 2, 3, ...) —
  // the second segment of /lp/:productSlug/:number. Never a slug/uuid: the
  // product's own slug already carries identity, this just distinguishes
  // multiple landing pages for the same product.
  private async nextNumber(productId: string): Promise<number> {
    const agg = await this.prisma.productLandingPage.aggregate({ where: { productId }, _max: { number: true } })
    return (agg._max.number ?? 0) + 1
  }

  // Kicks off generation of a NEW landing page (a create, not an upsert — a
  // product can have several): validates the chosen source images actually
  // belong to this product, assigns the next sequential number, seeds a
  // "Generating" row with one placeholder section per requested slot,
  // enqueues the job, and returns immediately — LandingPagesProcessor does
  // the actual AI work and the admin UI polls getById() for progress.
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

    const number = await this.nextNumber(productId)

    const sourceImagesBySection = distributeSourceImages(input.sourceImageUrls, input.sectionCount)
    const placeholderSections: LandingPageSection[] = Array.from({ length: input.sectionCount }, (_, i) => ({
      id: randomUUID(),
      order: i,
      role: i === 0 ? 'hero' : i === input.sectionCount - 1 ? 'cta' : 'feature',
      headline: '',
      body: '',
      imageUrl: null,
      sourceImageUrls: sourceImagesBySection[i]!.length > 0 ? sourceImagesBySection[i]! : input.sourceImageUrls,
      status: 'pending'
    }))

    const row = await this.prisma.productLandingPage.create({
      data: {
        productId,
        number,
        name: input.name ?? 'Landing Page',
        status: 'Generating',
        imageProvider: input.imageProvider,
        design: { language: input.language, style: input.style, accentColor: input.accentColor ?? null } as unknown as Prisma.InputJsonValue,
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
        number,
        sectionCount: input.sectionCount,
        sourceImageCount: input.sourceImageUrls.length,
        imageProvider: input.imageProvider,
        language: input.language,
        style: input.style
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

  // Fix a section's wording by hand: sanitized, re-drawn and re-stitched on the
  // spot (no AI call, about a second). The backstop for any line the model got
  // wrong — what you type is exactly what is drawn.
  async updateSection(id: string, sectionId: string, input: UpdateLandingPageSection, actor: AuditActor): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Landing page not found')
    if (row.status === 'Generating') throw new BadRequestException('This page is still being generated.')
    const sections = LandingPageSectionSchema.array().parse(row.sections)
    const index = sections.findIndex((x) => x.id === sectionId)
    if (index === -1) throw new NotFoundException('Section not found')

    const headline = sanitizeText(input.headline)
    const body = sanitizeText(input.body)
    if (!headline) throw new BadRequestException('The headline cannot be empty.')
    sections[index] = { ...sections[index]!, headline, body }
    return this.rerender(row, sections, actor, { action: 'edit-section', sectionId })
  }

  // Change the look (style / accent colour) of the whole page — re-drawn from the
  // stored backgrounds and photos, instantly.
  async updateDesign(id: string, input: UpdateLandingPageDesign, actor: AuditActor): Promise<ProductLandingPage> {
    const row = await this.prisma.productLandingPage.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Landing page not found')
    if (row.status === 'Generating') throw new BadRequestException('This page is still being generated.')
    const design = LandingDesignSchema.parse(row.design ?? {})
    const next = { ...design, ...(input.style && { style: input.style }), ...(input.accentColor !== undefined && { accentColor: input.accentColor }) }
    const updated = await this.prisma.productLandingPage.update({ where: { id }, data: { design: next as unknown as Prisma.InputJsonValue } })
    return this.rerender(updated, LandingPageSectionSchema.array().parse(updated.sections), actor, { action: 'restyle', ...input })
  }

  private async rerender(row: { id: string; productId: string; design: unknown; sections: unknown; [k: string]: unknown }, sections: LandingPageSection[], actor: AuditActor, meta: Record<string, unknown>): Promise<ProductLandingPage> {
    const design = LandingDesignSchema.parse(row.design ?? {})
    const ctx = await this.composer.prepare(design, sections.flatMap((x) => x.sourceImageUrls))
    if (ctx.photos.size === 0) throw new BadRequestException('None of the selected product photos could be read.')
    const out = [...sections]
    for (let i = 0; i < out.length; i++) {
      const buffer = await this.composer.renderOne(ctx, out, i, await this.composer.loadScene(out[i]!))
      out[i] = { ...out[i]!, imageUrl: this.composer.saveSectionImage(buffer), status: 'completed', errorMessage: null }
    }
    const finalImageUrl = await this.composer.stitchAndSave(out)
    const saved = await this.prisma.productLandingPage.update({
      where: { id: row.id },
      data: { sections: out as unknown as Prisma.InputJsonValue, finalImageUrl, status: 'Completed', errorMessage: null, design: ctx.design as unknown as Prisma.InputJsonValue }
    })
    await this.audit.log({ actor, action: 'Update', entity: 'ProductLandingPage', entityId: row.id, metadata: meta })
    return this.toView(saved)
  }

  // AI-written headline / subheadline / button label for a funnel's native
  // landing page. Built from everything the product holds, validated like the
  // image page copy, never saved here.
  async suggestCopy(productId: string, input: GenerateLandingCopy): Promise<GeneratedLandingCopy> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException('Product not found')
    const text = (html: string | null) => sanitizeText((html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '))
    const benefits = (product.keyBenefits as string[] | null) ?? []
    const specs = (product.specifications as { label: string; value: string }[] | null) ?? []
    const description = [text(product.description), benefits.length ? `Key benefits: ${benefits.join('; ')}` : '', specs.length ? `Specifications: ${specs.map((x) => `${x.label}: ${x.value}`).join('; ')}` : ''].filter(Boolean).join('\n')
    if (!description.trim()) throw new BadRequestException('Add a description to the product first: the copy is written from it.')
    return this.composer.produceLandingCopy({ productName: product.name, description, language: input.language, instructions: input.instructions })
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

    await this.audit.log({ actor, action: 'Delete', entity: 'ProductLandingPage', entityId: id, metadata: { number: row.number, productId: row.productId } })
  }

  // Public — the storefront's /lp/:productSlug/:number page fetches this.
  // Only ever returns something for a completed, enabled landing page; no
  // admin/generation internals leak through.
  async getPublicByProductSlugAndNumber(productSlug: string, number: number): Promise<PublicLandingPage | null> {
    const product = await this.prisma.product.findUnique({
      where: { slug: productSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        imageUrl: true,
        requireOfferSelection: true,
        // Same normalized options→attribute join as ProductsController's
        // GET /products/:slug — resolving through VariantOption/
        // AttributeOption (not just the legacy `attributes` JSON blob) is
        // what makes a variant's attributes and color swatches (see
        // VariantSwatchesSchema, packages/shared) match the normal PDP
        // exactly instead of only reflecting pre-normalized-system data.
        variants: {
          select: {
            id: true,
            productId: true,
            sku: true,
            attributes: true,
            priceCents: true,
            stockQuantity: true,
            options: {
              include: {
                option: {
                  include: { attribute: { select: { name: true, type: true } } }
                }
              }
            }
          }
        },
        offers: {
          where: { enabled: true },
          select: {
            id: true,
            productId: true,
            type: true,
            enabled: true,
            requiredQuantity: true,
            freeQuantity: true,
            bundlePriceCents: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })
    if (!product) return null

    const row = await this.prisma.productLandingPage.findUnique({
      where: { productId_number: { productId: product.id, number } }
    })
    if (!row || !row.enabled || row.status !== 'Completed' || !row.finalImageUrl) return null

    // Same resolution as ProductsController.findOne — merge normalized
    // options over the legacy JSON blob, then separately collect Color-type
    // swatches. See that method's comments for the reasoning.
    const variantSwatches: Record<string, Record<string, string>> = {}
    const variantsWithResolvedAttrs = product.variants.map((v) => {
      const resolved: Record<string, string> = {}
      for (const vo of v.options) {
        const key = vo.option.attribute.name.toLowerCase()
        resolved[key] = vo.option.value
        if (vo.option.attribute.type === 'Color' && vo.option.colorHex) {
          variantSwatches[key] ??= {}
          variantSwatches[key][vo.option.value] = vo.option.colorHex
        }
      }
      const legacyAttrs = (v.attributes as Record<string, string> | null) ?? {}
      const { options: _options, ...rest } = v
      return { ...rest, attributes: { ...legacyAttrs, ...resolved } }
    })

    return {
      id: row.id,
      number: row.number,
      finalImageUrl: row.finalImageUrl,
      product: {
        ...product,
        variants: variantsWithResolvedAttrs,
        variantSwatches,
        offers: product.offers.map((o) => ({
          ...o,
          type: o.type as 'FixedBundlePrice' | 'BuyXGetYFree' | 'FreeShipping',
          bundlePriceCents: o.bundlePriceCents ?? null,
          createdAt: o.createdAt?.toISOString() ?? null,
          updatedAt: o.updatedAt?.toISOString() ?? null
        }))
      }
    }
  }
}
