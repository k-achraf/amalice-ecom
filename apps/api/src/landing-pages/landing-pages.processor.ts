import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import sharp from 'sharp'
import { LandingDesignSchema, LandingPageSectionSchema, type LandingPageImageProvider, type LandingPageSection } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { LandingComposerService, type ComposeContext } from './landing-composer.service'
import type { InlineImage } from './gemini.service'

interface GenerateFullJob {
  landingPageId: string
  description: string
  instructions?: string
}

interface RegenerateSectionJob {
  landingPageId: string
  sectionId: string
  instructions?: string
}

// The background worker behind the landing-page builder. A page is composed, not
// painted: validated copy (landing-composer.service.ts) is drawn by code directly
// on the product's own photos (retouched first), section by section, then
// stitched into one long image. Progress is saved after every step so the admin
// UI (which polls) shows the copy first and each finished section as it lands.
// One section failing to draw fails the page; AI retouching being unavailable
// does not — the photo is enhanced by code instead, with a warning.
@Processor('landing-pages')
export class LandingPagesProcessor extends WorkerHost {
  private readonly logger = new Logger(LandingPagesProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly composer: LandingComposerService
  ) {
    super()
  }

  async process(job: Job<GenerateFullJob | RegenerateSectionJob>): Promise<void> {
    if (job.name === 'generate-full') await this.processGenerateFull(job as Job<GenerateFullJob>)
    else if (job.name === 'regenerate-section') await this.processRegenerateSection(job as Job<RegenerateSectionJob>)
  }

  private async load(landingPageId: string) {
    const row = await this.prisma.productLandingPage.findUniqueOrThrow({ where: { id: landingPageId }, include: { product: { select: { name: true } } } })
    return {
      sections: LandingPageSectionSchema.array().parse(row.sections),
      design: LandingDesignSchema.parse(row.design ?? {}),
      provider: row.imageProvider as LandingPageImageProvider,
      productName: row.product.name
    }
  }

  private async save(landingPageId: string, data: { sections?: LandingPageSection[]; status?: 'Generating' | 'Completed' | 'Failed'; finalImageUrl?: string | null; errorMessage?: string | null; design?: ComposeContext['design'] }) {
    await this.prisma.productLandingPage.update({
      where: { id: landingPageId },
      data: {
        ...(data.sections && { sections: data.sections as unknown as Prisma.InputJsonValue }),
        ...(data.status && { status: data.status }),
        ...(data.finalImageUrl !== undefined && { finalImageUrl: data.finalImageUrl }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
        ...(data.design && { design: data.design as unknown as Prisma.InputJsonValue })
      }
    })
  }

  // Small JPEGs of the first photos, for the model that analyses the product.
  private async inlinePhotos(ctx: ComposeContext): Promise<InlineImage[]> {
    const out: InlineImage[] = []
    for (const buf of [...ctx.photos.values()].slice(0, 2)) {
      try {
        out.push({ base64: (await sharp(buf).resize(768, 768, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()).toString('base64'), mimeType: 'image/jpeg' })
      } catch {
        /* unreadable photo: skip */
      }
    }
    return out
  }

  private async processGenerateFull(job: Job<GenerateFullJob>): Promise<void> {
    const { landingPageId, description, instructions } = job.data
    const { sections: loaded, design, provider, productName } = await this.load(landingPageId)
    let sections = loaded

    try {
      const ctx = await this.composer.prepare(design, sections.flatMap((s) => s.sourceImageUrls))
      if (ctx.photos.size === 0) throw new Error('None of the selected product photos could be read.')
      await this.save(landingPageId, { design: ctx.design })

      // ---- copy ----
      const copy = await this.composer.produceCopy({ productName, description, sectionCount: sections.length, language: ctx.design.language, instructions, photos: await this.inlinePhotos(ctx) })
      const warning = copy.warnings.join(' ') || null
      sections = sections.map((s, i) => ({
        ...s,
        role: copy.sections[i]?.role ?? s.role,
        headline: copy.sections[i]?.headline ?? '',
        body: copy.sections[i]?.body ?? '',
        status: 'generating' as const,
        errorMessage: null,
        warning: i === 0 ? warning : null
      }))
      await this.save(landingPageId, { sections })

      // ---- sections: retouched photo, then the copy drawn on it ----
      // A photo is retouched once however many sections use it.
      const prepared = new Map<string, { buffer: Buffer; url: string; warning: string | null }>()
      const photoFor = async (index: number) => {
        const source = this.composer.pickSource(ctx, sections[index]!, index)
        if (!source) throw new Error('This section has no readable photo.')
        const cached = prepared.get(source.url)
        if (cached) return cached
        const made = await this.composer.producePhoto({ provider, source: source.buffer, instructions })
        const entry = { buffer: made.buffer, url: this.composer.savePhoto(made.buffer), warning: made.warning }
        prepared.set(source.url, entry)
        return entry
      }

      for (let i = 0; i < sections.length; i++) {
        try {
          const photo = await photoFor(i)
          const buffer = await this.composer.renderOne(ctx, sections, i, photo.buffer)
          sections[i] = {
            ...sections[i]!,
            imageUrl: this.composer.saveSectionImage(buffer),
            sceneUrl: photo.url,
            status: 'completed',
            errorMessage: null,
            warning: [sections[i]!.warning, photo.warning].filter(Boolean).join(' ') || null
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(`Landing page ${landingPageId} section ${i + 1} failed to render: ${message}`)
          sections[i] = { ...sections[i]!, status: 'failed', errorMessage: message }
        }
        await this.save(landingPageId, { sections })
      }

      await this.finalize(landingPageId, sections)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} generation failed: ${message}`)
      await this.save(landingPageId, { status: 'Failed', errorMessage: message, sections: sections.map((s) => (s.status === 'completed' ? s : { ...s, status: 'failed' as const, errorMessage: message })) })
    }
  }

  private async finalize(landingPageId: string, sections: LandingPageSection[]): Promise<void> {
    const failed = sections.filter((s) => s.status !== 'completed' || !s.imageUrl)
    if (failed.length) {
      await this.save(landingPageId, { status: 'Failed', errorMessage: `${failed.length} of ${sections.length} section(s) failed. Regenerate them and the page will combine automatically.` })
      return
    }
    try {
      const finalImageUrl = await this.composer.stitchAndSave(sections)
      await this.save(landingPageId, { status: 'Completed', finalImageUrl, errorMessage: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.save(landingPageId, { status: 'Failed', errorMessage: `All sections were made but combining them failed: ${message}` })
    }
  }

  // "Regenerate" on one section: the photo retouched again (steered by the
  // instructions, if any) and a re-render with the current copy. Sections that
  // have no image yet (pages made before this pipeline) are rendered too, so the
  // page can always be completed.
  private async processRegenerateSection(job: Job<RegenerateSectionJob>): Promise<void> {
    const { landingPageId, sectionId, instructions } = job.data
    const { sections: loaded, design, provider } = await this.load(landingPageId)
    const sections = loaded
    const index = sections.findIndex((s) => s.id === sectionId)
    if (index === -1) {
      this.logger.warn(`Landing page ${landingPageId}: section ${sectionId} no longer exists, skipping regenerate.`)
      return
    }

    try {
      const ctx = await this.composer.prepare(design, sections.flatMap((s) => s.sourceImageUrls))
      if (ctx.photos.size === 0) throw new Error('None of the selected product photos could be read.')

      const source = this.composer.pickSource(ctx, sections[index]!, index)
      if (!source) throw new Error('This section has no readable photo.')
      const made = await this.composer.producePhoto({ provider, source: source.buffer, instructions })
      sections[index] = {
        ...sections[index]!,
        imageUrl: this.composer.saveSectionImage(await this.composer.renderOne(ctx, sections, index, made.buffer)),
        sceneUrl: this.composer.savePhoto(made.buffer),
        status: 'completed',
        errorMessage: null,
        warning: made.warning
      }
      for (let i = 0; i < sections.length; i++) {
        if (sections[i]!.imageUrl) continue
        sections[i] = { ...sections[i]!, imageUrl: this.composer.saveSectionImage(await this.composer.renderOne(ctx, sections, i, await this.composer.loadPrepared(sections[i]!))), status: 'completed', errorMessage: null }
      }
      await this.save(landingPageId, { sections, design: ctx.design })
      await this.finalize(landingPageId, sections)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} section ${sectionId} regenerate failed: ${message}`)
      await this.save(landingPageId, { status: 'Failed', errorMessage: message, sections: sections.map((s, i) => (i === index ? { ...s, status: 'failed' as const, errorMessage: message } : s)) })
    }
  }
}
