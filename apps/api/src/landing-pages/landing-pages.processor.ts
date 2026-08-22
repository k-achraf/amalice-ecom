import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { LandingPageSectionSchema, type LandingPageImageProvider, type LandingPageSection } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '../generated/prisma/client'
import { GeminiService } from './gemini.service'
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
// orchestrates. Gemini composes the whole long-scroll page in ONE image
// call (generateFullGeminiImage) instead of one call per section — see
// gemini.service.ts's top comment. Pollinations has no photo-editing or
// multi-section-in-one-image ability (text-to-image only, no real product
// photos), so it keeps the original per-section-then-stitch approach.
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
  ): Promise<{ sections: LandingPageSection[]; imageProvider: LandingPageImageProvider; productName: string; finalImageUrl: string | null }> {
    const row = await this.prisma.productLandingPage.findUniqueOrThrow({
      where: { id: landingPageId },
      include: { product: true }
    })
    return {
      sections: LandingPageSectionSchema.array().parse(row.sections),
      imageProvider: row.imageProvider as LandingPageImageProvider,
      productName: row.product.name,
      finalImageUrl: row.finalImageUrl
    }
  }

  private async saveSections(landingPageId: string, sections: LandingPageSection[]): Promise<void> {
    await this.prisma.productLandingPage.update({
      where: { id: landingPageId },
      data: { sections: sections as unknown as Prisma.InputJsonValue }
    })
  }

  // Pollinations section image, in place within a sections array — shared
  // by both the full-generation and single-section-regenerate paths so they
  // can't drift. Mutates and returns the same array reference. Gemini never
  // goes through this — see generateFullGeminiImage / regenerateGeminiSection.
  private async generatePollinationsSection(
    sections: LandingPageSection[],
    index: number,
    productName: string,
    instructions?: string
  ): Promise<LandingPageSection[]> {
    const section = sections[index]
    try {
      const generated = await this.pollinations.generateSectionImage({
        role: section.role,
        headline: section.headline,
        body: section.body,
        productName,
        instructions
      })
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
  // — this only decides the OVERALL status). Pollinations only — the Gemini
  // path produces (or fails to produce) the final image directly, with no
  // separate stitching step.
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

  // Generates the ENTIRE long-scroll page in one Gemini call from every
  // section's drafted copy plus the union of all sections' source photos
  // (distributeSourceImages spread the store owner's picks across sections
  // for the old per-section approach — one shot wants the whole set they
  // picked, deduped, once). No per-section imageUrl is ever set for Gemini;
  // only finalImageUrl.
  private async generateFullGeminiImage(landingPageId: string, sections: LandingPageSection[], instructions?: string): Promise<void> {
    const ordered = [...sections].sort((a, b) => a.order - b.order)
    const sourceImageUrls = [...new Set(ordered.flatMap((s) => s.sourceImageUrls))]
    try {
      const sourceImages = await Promise.all(sourceImageUrls.map((url) => fetchImageAsInline(url)))
      const generated = await this.gemini.generateLandingPageImage({
        sections: ordered.map((s) => ({ role: s.role, headline: s.headline, body: s.body })),
        sourceImages,
        instructions
      })
      const finalImageUrl = saveGeneratedImage(generated.base64, generated.mimeType)
      const completed = sections.map((s) => ({ ...s, status: 'completed' as const, errorMessage: null }))
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Completed', finalImageUrl, errorMessage: null, sections: completed as unknown as Prisma.InputJsonValue }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} full-image generation failed: ${message}`)
      const failed = sections.map((s) => ({ ...s, status: 'failed' as const, errorMessage: message }))
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Failed', errorMessage: message, sections: failed as unknown as Prisma.InputJsonValue }
      })
    }
  }

  // Edits the current full image in place to redo just one section (see
  // gemini.service.ts's editLandingPageImage) instead of regenerating the
  // whole page. If there's no full image yet (the very first generation
  // never completed), falls back to a from-scratch full generation.
  private async regenerateGeminiSection(
    landingPageId: string,
    sections: LandingPageSection[],
    index: number,
    currentFinalImageUrl: string | null,
    instructions?: string
  ): Promise<void> {
    const section = sections[index]
    if (!currentFinalImageUrl) {
      await this.generateFullGeminiImage(landingPageId, sections, instructions)
      return
    }
    try {
      const [currentImage, sourceImages] = await Promise.all([
        fetchImageAsInline(currentFinalImageUrl),
        Promise.all(section.sourceImageUrls.map((url) => fetchImageAsInline(url)))
      ])
      const generated = await this.gemini.editLandingPageImage({
        currentImage,
        targetSection: { role: section.role, headline: section.headline, body: section.body },
        instructions,
        sourceImages
      })
      const finalImageUrl = saveGeneratedImage(generated.base64, generated.mimeType)
      const updatedSections = sections.map((s, i) => (i === index ? { ...s, status: 'completed' as const, errorMessage: null } : s))
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Completed', finalImageUrl, errorMessage: null, sections: updatedSections as unknown as Prisma.InputJsonValue }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Landing page ${landingPageId} section ${section.id} edit failed: ${message}`)
      const failedSections = sections.map((s, i) => (i === index ? { ...s, status: 'failed' as const, errorMessage: message } : s))
      await this.prisma.productLandingPage.update({
        where: { id: landingPageId },
        data: { status: 'Failed', errorMessage: message, sections: failedSections as unknown as Prisma.InputJsonValue }
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

    if (imageProvider === 'Gemini') {
      await this.generateFullGeminiImage(landingPageId, sections, instructions)
      return
    }

    // Pollinations — sections generated sequentially, not in parallel, to
    // stay within the free tier's per-minute rate limits instead of
    // bursting N simultaneous requests at once.
    for (let i = 0; i < sections.length; i++) {
      sections = await this.generatePollinationsSection(sections, i, productName, instructions)
      await this.saveSections(landingPageId, sections)
    }

    await this.finalizeIfComplete(landingPageId, sections)
  }

  private async processRegenerateSection(job: Job<RegenerateSectionJob>): Promise<void> {
    const { landingPageId, sectionId, instructions } = job.data
    const { sections: loadedSections, imageProvider, productName, finalImageUrl } = await this.loadRow(landingPageId)
    const sections = loadedSections
    const index = sections.findIndex((s) => s.id === sectionId)
    if (index === -1) {
      this.logger.warn(`Landing page ${landingPageId}: section ${sectionId} no longer exists, skipping regenerate.`)
      return
    }

    if (imageProvider === 'Gemini') {
      await this.regenerateGeminiSection(landingPageId, sections, index, finalImageUrl, instructions)
      return
    }

    const updated = await this.generatePollinationsSection(sections, index, productName, instructions)
    await this.saveSections(landingPageId, updated)
    await this.finalizeIfComplete(landingPageId, updated)
  }
}
