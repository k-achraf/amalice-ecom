import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { LandingPageSectionSchema, type LandingPageImageProvider, type LandingPageSection } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { GeminiService, type InlineImage } from './gemini.service'
import { PollinationsService } from './pollinations.service'
import { draftSectionCopyHeuristically } from './heuristic-copy.util'
import { fetchImageAsInline, saveGeneratedImage, stitchSectionsVertically } from './landing-page-storage.util'

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

// Does the actual AI work for the landing-page builder — see
// landing-pages.service.ts for what enqueues these jobs, and
// gemini.service.ts / landing-page-storage.util.ts for the pieces this
// orchestrates (copy drafting, per-section image generation, disk storage,
// vertical stitching).
@Processor('landing-pages')
export class LandingPagesProcessor extends WorkerHost {
  private readonly logger = new Logger(LandingPagesProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly pollinations: PollinationsService
  ) {
    super()
  }

  async process(job: Job<GenerateFullJob | RegenerateSectionJob>): Promise<void> {
    if (job.name === 'generate-full') {
      await this.processGenerateFull(job as Job<GenerateFullJob>)
    } else if (job.name === 'regenerate-section') {
      await this.processRegenerateSection(job as Job<RegenerateSectionJob>)
    }
  }

  // Sections + which image provider to use + the product name (needed by
  // Pollinations, which has no product photo to infer it from) — one query
  // covers both the full-generation and single-section-regenerate paths.
  private async loadRow(
    landingPageId: string
  ): Promise<{ sections: LandingPageSection[]; imageProvider: LandingPageImageProvider; productName: string }> {
    const row = await this.prisma.productLandingPage.findUniqueOrThrow({
      where: { id: landingPageId },
      include: { product: true }
    })
    return {
      sections: LandingPageSectionSchema.array().parse(row.sections),
      imageProvider: row.imageProvider as LandingPageImageProvider,
      productName: row.product.name
    }
  }

  private async saveSections(landingPageId: string, sections: LandingPageSection[]): Promise<void> {
    await this.prisma.productLandingPage.update({
      where: { id: landingPageId },
      data: { sections: sections as unknown as Prisma.InputJsonValue }
    })
  }

  // Generates ONE section's image in place within a sections array —
  // shared by both the full-generation and single-section-regenerate paths
  // so they can't drift. Mutates and returns the same array reference.
  private async generateOneSection(
    sections: LandingPageSection[],
    index: number,
    imageProvider: LandingPageImageProvider,
    productName: string,
    instructions?: string
  ): Promise<LandingPageSection[]> {
    const section = sections[index]
    try {
      let generated: InlineImage
      if (imageProvider === 'Pollinations') {
        generated = await this.pollinations.generateSectionImage({
          role: section.role,
          headline: section.headline,
          body: section.body,
          productName,
          instructions
        })
      } else {
        const sourceImages = await Promise.all(section.sourceImageUrls.map((url) => fetchImageAsInline(url)))
        // If this section already has a generated image AND we're re-running
        // it with instructions, treat it as an EDIT of that existing image
        // (see gemini.service.ts's editImage param) instead of a from-
        // scratch composition — that's what "regenerate with instructions"
        // means in the admin UI.
        const editImage = instructions && section.imageUrl ? await fetchImageAsInline(section.imageUrl) : undefined
        generated = await this.gemini.generateSectionImage({
          role: section.role,
          headline: section.headline,
          body: section.body,
          sourceImages,
          instructions,
          editImage
        })
      }
      const imageUrl = saveGeneratedImage(generated.base64, generated.mimeType)
      sections[index] = { ...section, imageUrl, status: 'completed', errorMessage: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sections[index] = { ...section, status: 'failed', errorMessage: message }
      this.logger.warn(`Landing page section ${section.id} (${section.role}) failed: ${message}`)
    }
    return sections
  }

  // If every section has a generated image, stitches them into the final
  // long image and marks the row Completed; otherwise marks it Failed with
  // a summary (individual section images/errors remain visible either way
  // — this only decides the OVERALL status).
  private async finalizeIfComplete(landingPageId: string, sections: LandingPageSection[]): Promise<void> {
    const failed = sections.filter((s) => s.status !== 'completed')
    if (failed.length > 0) {
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: {
          status: 'Failed',
          errorMessage: `${failed.length} of ${sections.length} section(s) failed to generate. Regenerate them individually, then they'll combine automatically.`
        }
      })
      return
    }

    const orderedUrls = [...sections].sort((a, b) => a.order - b.order).map((s) => s.imageUrl!)
    try {
      const finalImageUrl = await stitchSectionsVertically(orderedUrls)
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Completed', finalImageUrl, errorMessage: null }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} stitching failed: ${message}`)
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Failed', errorMessage: `All sections generated but combining them failed: ${message}` }
      })
    }
  }

  private async processGenerateFull(job: Job<GenerateFullJob>): Promise<void> {
    const { landingPageId, description, instructions } = job.data
    const { sections: loadedSections, imageProvider, productName } = await this.loadRow(landingPageId)
    let sections = loadedSections

    try {
      // Pollinations has no text/LLM endpoint of its own and is meant to be
      // a Gemini-free path, so it drafts copy heuristically (no AI call,
      // no cost, no key) instead of via Gemini's text model.
      const copy =
        imageProvider === 'Pollinations'
          ? draftSectionCopyHeuristically({ productName, description, sectionCount: sections.length })
          : await this.gemini.draftSectionCopy({ productName, description, sectionCount: sections.length, instructions })
      sections = sections.map((section, i) => ({
        ...section,
        role: copy[i]?.role ?? section.role,
        headline: copy[i]?.headline ?? '',
        body: copy[i]?.body ?? ''
      }))
      await this.saveSections(landingPageId, sections)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} copy drafting failed: ${message}`)
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Failed', errorMessage: `Could not draft section copy: ${message}` }
      })
      return
    }

    // Sections generated sequentially, not in parallel — keeps this within
    // the free tier's per-minute rate limits instead of bursting N
    // simultaneous requests at once.
    for (let i = 0; i < sections.length; i++) {
      sections = await this.generateOneSection(sections, i, imageProvider, productName, instructions)
      await this.saveSections(landingPageId, sections)
    }

    await this.finalizeIfComplete(landingPageId, sections)
  }

  private async processRegenerateSection(job: Job<RegenerateSectionJob>): Promise<void> {
    const { landingPageId, sectionId, instructions } = job.data
    const { sections: loadedSections, imageProvider, productName } = await this.loadRow(landingPageId)
    let sections = loadedSections
    const index = sections.findIndex((s) => s.id === sectionId)
    if (index === -1) {
      this.logger.warn(`Landing page ${landingPageId}: section ${sectionId} no longer exists, skipping regenerate.`)
      return
    }

    sections = await this.generateOneSection(sections, index, imageProvider, productName, instructions)
    await this.saveSections(landingPageId, sections)
    await this.finalizeIfComplete(landingPageId, sections)
  }
}
