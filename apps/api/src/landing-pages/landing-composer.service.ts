import { Injectable, Logger } from '@nestjs/common'
import type { LandingDesign, LandingLanguage, LandingPageImageProvider, LandingPageSection } from '@amalice/shared'
import { GeminiService, type DraftedSection, type InlineImage, type ProductBrief } from './gemini.service'
import { fallbackCopy, sanitizeText, validateCopy, validateLine, type CopySection } from './landing-copy.util'
import { accentFromPhoto, buildPalette, enhanceLocal, renderSection, stitchBuffers, type Palette } from './landing-page-render.util'
import { loadImageBuffer, saveBuffer } from './landing-page-storage.util'
import sharp from 'sharp'

const MAX_COPY_ATTEMPTS = 3
const MAX_PHOTO_ATTEMPTS = 2
const MAX_PROOF_PASSES = 3

export interface ComposeContext {
  design: Required<Pick<LandingDesign, 'language' | 'style'>> & { accentColor: string }
  palette: Palette
  // Source photos by URL, loaded once.
  photos: Map<string, Buffer>
}

// Everything that turns a product into a finished landing page: validated copy,
// retouched product photos, and the code-side composition of each section (the
// copy drawn directly on the photo).
// Used by the background job (full generation / per-section regeneration) and by
// the synchronous edits (copy fix, restyle), so all of them draw identically.
@Injectable()
export class LandingComposerService {
  private readonly logger = new Logger(LandingComposerService.name)

  constructor(private readonly gemini: GeminiService) {}

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
      brief = await this.gemini.analyzeProduct({ productName: input.productName, description: input.description, language: input.language, photos: input.photos, instructions: input.instructions })
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
          // Dedicated proofreading passes, repeated until a pass finds nothing left to
          // change (two independent readings agree), each result validated again and
          // only kept when it is still clean.
          for (let pass = 1; pass <= MAX_PROOF_PASSES; pass++) {
            try {
              const proofed = this.toCopy(await this.gemini.proofreadCopy({ sections: draft, language: input.language }))
              if (validateCopy(proofed, ctx).length > 0) break
              const changed = proofed.some((s, i) => s.headline !== draft[i]?.headline || s.body !== draft[i]?.body)
              draft = proofed
              if (!changed) break
            } catch (error) {
              this.logger.warn(`Proofreading skipped: ${(error as Error).message}`)
              break
            }
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
      brief = await this.gemini.analyzeProduct({ productName: input.productName, description: input.description, language: input.language, instructions: input.instructions })
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

  // ---- photos --------------------------------------------------------------

  // The source photo a section is drawn on (its own photos in rotation, or any of
  // the page's photos when it has none).
  pickSource(ctx: ComposeContext, section: LandingPageSection, index: number): { url: string; buffer: Buffer } | null {
    const own = section.sourceImageUrls.filter((u) => ctx.photos.has(u))
    const urls = own.length ? own : [...ctx.photos.keys()]
    if (!urls.length) return null
    const url = urls[index % urls.length]!
    return { url, buffer: ctx.photos.get(url)! }
  }

  // The photo the section is drawn on: the real product photo, cleaned up by code
  // and then (Gemini provider) retouched by the image model — lighting, colour,
  // sharpness, overlaid captions/banners/watermarks removed. The retouched version
  // is compared with the original by a vision check and only used if the product is
  // intact; otherwise the code-enhanced original is used. Never fails the page.
  async producePhoto(input: { provider: LandingPageImageProvider; source: Buffer; instructions?: string }): Promise<{ buffer: Buffer; warning: string | null }> {
    const base = await enhanceLocal(input.source)
    if (input.provider !== 'Gemini') return { buffer: base, warning: null }

    let lastReason = 'unavailable'
    try {
      const small = await sharp(base).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()
      const meta = await sharp(small).metadata()
      const original: InlineImage = { base64: small.toString('base64'), mimeType: 'image/jpeg' }
      for (let attempt = 1; attempt <= MAX_PHOTO_ATTEMPTS; attempt++) {
        try {
          const edited = await this.gemini.enhancePhoto({ image: original, width: meta.width ?? 1, height: meta.height ?? 1, instructions: input.instructions })
          const check = await this.gemini.checkEnhanced(original, edited)
          if (!check.ok) {
            lastReason = check.reasons.join(', ')
            this.logger.warn(`Retouched photo rejected (attempt ${attempt}): ${lastReason}`)
            continue
          }
          // Final polish by code, so every section has the same crispness.
          return { buffer: await enhanceLocal(Buffer.from(edited.base64, 'base64')), warning: null }
        } catch (error) {
          lastReason = (error as Error).message
          this.logger.warn(`Photo retouching failed (attempt ${attempt}): ${lastReason}`)
          // Billing / quota / blocked errors won't improve on a retry.
          if (/billing|quota|permission|API key|blocked|not found|prepay/i.test(lastReason)) break
        }
      }
    } catch (error) {
      lastReason = (error as Error).message
    }
    return { buffer: base, warning: `AI photo retouching was not used (${lastReason.slice(0, 120)}): the photo was enhanced automatically instead.` }
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

  // `prepared` is the section's retouched photo (see producePhoto); without one the
  // source photo is enhanced on the fly.
  async renderOne(ctx: ComposeContext, sections: LandingPageSection[], index: number, prepared: Buffer | null): Promise<Buffer> {
    const section = sections[index]!
    const featureNumber = sections.slice(0, index + 1).filter((s) => s.role === 'feature').length
    const photo = prepared ?? (await enhanceLocal(this.pickSource(ctx, section, index)!.buffer))
    return renderSection({
      role: section.role,
      index,
      featureNumber,
      headline: section.headline,
      body: section.body,
      language: ctx.design.language,
      style: ctx.design.style,
      palette: ctx.palette,
      photo
    })
  }

  // The stored retouched photo of a section (kept so copy edits and restyles re-draw
  // instantly without another AI call).
  async loadPrepared(section: LandingPageSection): Promise<Buffer | null> {
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

  savePhoto(buffer: Buffer): string {
    return saveBuffer(buffer, '.jpg')
  }
}
