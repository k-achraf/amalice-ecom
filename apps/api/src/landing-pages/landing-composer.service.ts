import { Injectable, Logger } from '@nestjs/common'
import type { LandingDesign, LandingLanguage, LandingPageImageProvider, LandingPageSection } from '@amalice/shared'
import { GeminiService, type DraftedSection, type InlineImage, type ProductBrief } from './gemini.service'
import { PollinationsService } from './pollinations.service'
import { fallbackCopy, sanitizeText, validateCopy, validateLine, type CopySection } from './landing-copy.util'
import { accentFromPhoto, buildPalette, paletteHint, renderSection, stitchBuffers, type Palette } from './landing-page-render.util'
import { loadImageBuffer, saveBuffer } from './landing-page-storage.util'

const MAX_COPY_ATTEMPTS = 3
const MAX_SCENE_ATTEMPTS = 2

export interface ComposeContext {
  design: Required<Pick<LandingDesign, 'language' | 'style'>> & { accentColor: string }
  palette: Palette
  // Source photos by URL, loaded once.
  photos: Map<string, Buffer>
}

// Everything that turns a product into a finished landing page: validated copy,
// text-free background scenes, and the code-side composition of each section.
// Used by the background job (full generation / per-section regeneration) and by
// the synchronous edits (copy fix, restyle), so all of them draw identically.
@Injectable()
export class LandingComposerService {
  private readonly logger = new Logger(LandingComposerService.name)

  constructor(
    private readonly gemini: GeminiService,
    private readonly pollinations: PollinationsService
  ) {}

  // ---- copy ---------------------------------------------------------------

  private toCopy(list: DraftedSection[]): CopySection[] {
    return list.map((s) => ({ role: s.role, headline: sanitizeText(s.headline ?? ''), body: sanitizeText(s.body ?? '') }))
  }

  // Brief → draft → validate → proofread → validate, retrying with the concrete
  // problems as feedback, and finally falling back section by section to plain
  // copy built from the product information. Always returns usable, validated copy.
  async produceCopy(input: {
    productName: string
    description: string
    sectionCount: number
    language: LandingLanguage
    instructions?: string
    photos?: InlineImage[]
  }): Promise<{ sections: CopySection[]; brief?: ProductBrief; warnings: string[] }> {
    const warnings: string[] = []
    const ctx = { language: input.language, sectionCount: input.sectionCount, sourceText: [input.productName, input.description, input.instructions ?? ''].join('\n') }
    const fallback = () => fallbackCopy({ productName: input.productName, description: input.description, sectionCount: input.sectionCount, language: input.language })

    let brief: ProductBrief | undefined
    try {
      brief = await this.gemini.analyzeProduct({ productName: input.productName, description: input.description, photos: input.photos, instructions: input.instructions })
    } catch (error) {
      this.logger.warn(`Product analysis failed: ${(error as Error).message}`)
    }

    let previous: CopySection[] | undefined
    let feedback: string[] | undefined
    try {
      for (let attempt = 1; attempt <= MAX_COPY_ATTEMPTS; attempt++) {
        let draft = this.toCopy(
          await this.gemini.draftSectionCopy({ productName: input.productName, description: input.description, sectionCount: input.sectionCount, language: input.language, brief, instructions: input.instructions, feedback, previous })
        )
        let issues = validateCopy(draft, ctx)
        if (issues.length === 0) {
          // A dedicated proofreading pass; its result is validated again and
          // only kept when it is still clean.
          try {
            const proofed = this.toCopy(await this.gemini.proofreadCopy({ sections: draft, language: input.language }))
            if (validateCopy(proofed, ctx).length === 0) draft = proofed
          } catch (error) {
            this.logger.warn(`Proofreading skipped: ${(error as Error).message}`)
          }
          return { sections: draft, brief, warnings }
        }
        this.logger.warn(`Copy attempt ${attempt} rejected: ${issues.map((i) => i.message).join(' | ')}`)
        previous = draft
        feedback = issues.map((i) => i.message)
        if (attempt === MAX_COPY_ATTEMPTS) {
          // Keep every section that is clean; replace only the broken ones.
          const bad = new Set(issues.map((i) => i.index).filter((i): i is number => i !== null))
          const plain = fallback()
          const merged = draft.length === input.sectionCount && !issues.some((i) => i.index === null) ? draft.map((s, i) => (bad.has(i) ? plain[i]! : s)) : plain
          warnings.push('Some AI wording failed the quality checks and was replaced with plain text from the product information. Review the text below.')
          return { sections: merged, brief, warnings }
        }
      }
    } catch (error) {
      this.logger.warn(`AI copy unavailable, using plain copy: ${(error as Error).message}`)
      warnings.push('AI copy was unavailable, so the text comes straight from the product information. Review and edit it below.')
    }
    return { sections: fallback(), brief, warnings }
  }

  // Headline / subheadline / button label for a funnel's native landing page.
  async produceLandingCopy(input: { productName: string; description: string; language: LandingLanguage; instructions?: string }): Promise<{ headline: string; subheadline: string; ctaLabel: string; warnings: string[] }> {
    const ctx = { language: input.language, sectionCount: 0, sourceText: [input.productName, input.description, input.instructions ?? ''].join('\n') }
    let brief: ProductBrief | undefined
    try {
      brief = await this.gemini.analyzeProduct({ productName: input.productName, description: input.description, instructions: input.instructions })
    } catch {
      /* the draft works without the analysis */
    }
    let feedback: string[] | undefined
    let last: { headline: string; subheadline: string; ctaLabel: string } | null = null
    for (let attempt = 1; attempt <= MAX_COPY_ATTEMPTS; attempt++) {
      const raw = await this.gemini.draftLandingCopy({ productName: input.productName, description: input.description, language: input.language, brief, instructions: input.instructions, feedback })
      last = { headline: sanitizeText(raw.headline), subheadline: sanitizeText(raw.subheadline), ctaLabel: sanitizeText(raw.ctaLabel) }
      const issues = [
        ...validateLine(last.headline, 'Headline', 'headline', ctx, 10),
        ...validateLine(last.subheadline, 'Subheadline', 'sentence', ctx, 24),
        ...validateLine(last.ctaLabel, 'Button', 'label', ctx, 6)
      ]
      if (!issues.length) return { ...last, warnings: [] }
      feedback = issues.map((i) => i.message)
    }
    return { ...last!, warnings: feedback ?? [] }
  }

  // ---- scenes -------------------------------------------------------------

  // One text-free background. Never fails the page: if no usable AI scene can be
  // had (no billing, rate limit, or the checks keep rejecting it) the section
  // uses a designed gradient instead and carries a warning.
  async produceScene(input: {
    provider: LandingPageImageProvider
    role: 'hero' | 'feature' | 'cta'
    brief?: ProductBrief
    productName: string
    palette: Palette
    style: 'vibrant' | 'dark' | 'light'
    instructions?: string
  }): Promise<{ buffer: Buffer | null; warning: string | null }> {
    if (input.provider === 'Template') return { buffer: null, warning: null }
    const sceneKeywords = input.brief?.sceneKeywords || `${input.productName}, elegant studio backdrop, soft light`
    let lastReason = 'unavailable'
    for (let attempt = 1; attempt <= MAX_SCENE_ATTEMPTS; attempt++) {
      try {
        const image: InlineImage =
          input.provider === 'Gemini'
            ? await this.gemini.generateScene({ role: input.role, sceneKeywords, paletteHint: paletteHint(input.palette, input.style), style: input.style, instructions: input.instructions })
            : await this.pollinations.generateScene({ role: input.role, sceneKeywords, instructions: input.instructions })
        try {
          const check = await this.gemini.checkScene(image)
          if (!check.ok) {
            lastReason = check.reasons.join(', ')
            this.logger.warn(`Scene rejected (attempt ${attempt}): ${lastReason}`)
            continue
          }
        } catch (error) {
          // No vision check available (e.g. no key on the Pollinations path):
          // the image is only a backdrop under a tint, so accept it.
          this.logger.warn(`Scene check skipped: ${(error as Error).message}`)
        }
        return { buffer: Buffer.from(image.base64, 'base64'), warning: null }
      } catch (error) {
        lastReason = (error as Error).message
        this.logger.warn(`Scene generation failed (attempt ${attempt}): ${lastReason}`)
        // Billing / quota / blocked errors won't improve on a retry.
        if (/billing|quota|permission|API key|blocked|not found|prepay/i.test(lastReason)) break
      }
    }
    return { buffer: null, warning: `The AI background was unavailable (${lastReason.slice(0, 120)}), so a designed background was used.` }
  }

  // ---- composition ----------------------------------------------------------

  async prepare(design: LandingDesign, sourceUrls: string[]): Promise<ComposeContext> {
    const photos = new Map<string, Buffer>()
    for (const url of [...new Set(sourceUrls)]) {
      try {
        photos.set(url, await loadImageBuffer(url))
      } catch (error) {
        this.logger.warn(`Source photo skipped (${url}): ${(error as Error).message}`)
      }
    }
    const first = photos.values().next().value as Buffer | undefined
    const accentColor = design.accentColor ?? (await accentFromPhoto(first))
    return {
      design: { language: design.language ?? 'ar', style: design.style ?? 'vibrant', accentColor },
      palette: buildPalette(accentColor),
      photos
    }
  }

  async renderOne(ctx: ComposeContext, sections: LandingPageSection[], index: number, scene: Buffer | null): Promise<Buffer> {
    const section = sections[index]!
    const featureNumber = sections.slice(0, index + 1).filter((s) => s.role === 'feature').length
    const photos = section.sourceImageUrls.map((u) => ctx.photos.get(u)).filter((b): b is Buffer => !!b)
    const all = photos.length ? photos : [...ctx.photos.values()]
    return renderSection({
      role: section.role,
      index,
      featureNumber,
      headline: section.headline,
      body: section.body,
      language: ctx.design.language,
      style: ctx.design.style,
      palette: ctx.palette,
      scene,
      photos: all
    })
  }

  async loadScene(section: LandingPageSection): Promise<Buffer | null> {
    if (!section.sceneUrl) return null
    try {
      return await loadImageBuffer(section.sceneUrl)
    } catch {
      return null
    }
  }

  // Stitches the section images (by URL) into the final long image and stores it.
  async stitchAndSave(sections: LandingPageSection[]): Promise<string> {
    const ordered = [...sections].sort((a, b) => a.order - b.order)
    const buffers = await Promise.all(ordered.map((s) => loadImageBuffer(s.imageUrl!)))
    return saveBuffer(await stitchBuffers(buffers), '.webp')
  }

  saveSectionImage(buffer: Buffer): string {
    return saveBuffer(buffer, '.webp')
  }

  saveScene(buffer: Buffer): string {
    return saveBuffer(buffer, '.png')
  }
}
