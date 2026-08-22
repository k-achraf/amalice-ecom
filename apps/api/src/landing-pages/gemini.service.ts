import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.validation'

// Google's Generative Language API (Gemini) — REST, camelCase JSON, unlike
// Meta/TikTok's snake_case APIs (see meta-conversions-api.service.ts /
// tiktok-events-api.service.ts for those). Model ids are date/version-
// stamped by Google and occasionally renamed between preview and GA — same
// rolling-deprecation caveat as GRAPH_API_VERSION / EVENTS_API_VERSION in
// the pixel services; these two constants are the ones to bump if Google
// renames or retires either model.
const TEXT_MODEL = 'gemini-flash-latest'
const IMAGE_MODEL = 'gemini-3.1-flash-image'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface InlineImage {
  base64: string
  mimeType: string
}

export interface DraftedSection {
  role: 'hero' | 'feature' | 'cta'
  headline: string
  body: string
}

// Loosely-typed mirror of @amalice/shared's GeneratedProductContentSchema —
// this file intentionally has no @amalice/shared dependency (it's a plain
// REST client), so the caller (AdminProductManagementService) re-validates
// the parsed JSON against that schema before it reaches the admin UI.
export interface DraftedProductContent {
  name: string
  description: string
  keyBenefits: string[]
  faqs: { question: string; answer: string }[]
  specifications: { label: string; value: string }[]
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

// Talks to Gemini (free-tier text + image models) for two admin AI
// features: the landing page builder (packages/shared/src/landing-page.ts —
// one text call drafts per-section marketing copy, then ONE image call
// composes the product's own photos and every section's copy into the whole
// long-scroll page at once, see generateLandingPageImage/
// editLandingPageImage — no per-section images, no after-the-fact
// stitching), and the product editor's "generate with AI" content drafter
// (draftProductContent — turns a raw content dump + optional photos into a
// name/description/keyBenefits/faqs/specifications draft, same free text
// model and structured-JSON-output approach as draftSectionCopy).
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name)

  constructor(private readonly config: ConfigService<Env, true>) {}

  private requireApiKey(): string {
    const key = this.config.get('GEMINI_API_KEY', { infer: true })
    if (!key) {
      throw new BadRequestException(
        'AI landing pages need a Gemini API key. Get a free one at https://aistudio.google.com/apikey and set GEMINI_API_KEY in the API server .env.'
      )
    }
    return key
  }

  private async post(model: string, apiKey: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    let response: Response
    try {
      response = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      })
    } catch (error) {
      throw new BadGatewayException(`Could not reach the Gemini API: ${(error as Error).message}`)
    }

    const json = (await response.json().catch(() => ({}))) as GeminiResponse
    if (!response.ok) {
      throw new BadGatewayException(`Gemini API error: ${json.error?.message ?? `HTTP ${response.status}`}`)
    }
    if (json.promptFeedback?.blockReason) {
      throw new BadGatewayException(`Gemini blocked the request: ${json.promptFeedback.blockReason}`)
    }
    return json
  }

  // Turns a raw product description into short, punchy per-section
  // marketing copy — a plain product description reads badly pasted
  // verbatim onto a landing-page image. Uses structured JSON output so the
  // result is directly usable without prompt-parsing heuristics.
  async draftSectionCopy(input: { productName: string; description: string; sectionCount: number; instructions?: string }): Promise<DraftedSection[]> {
    const apiKey = this.requireApiKey()

    const featureCount = Math.max(1, input.sectionCount - 2)
    const prompt = `You are writing short marketing copy for a cash-on-delivery e-commerce product's long-scroll landing page image (the AliExpress/TikTok-ad style single-image funnel).

Product: ${input.productName}
Description: ${input.description}
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely — they override the defaults below where they conflict): ${input.instructions}\n` : ''}
Write exactly ${input.sectionCount} sections in this order:
1. One "hero" section — a bold, attention-grabbing headline (max 6 words) and one short supporting line (max 12 words).
2. ${featureCount} "feature" section(s) — each highlights one distinct benefit or feature from the description, with a punchy headline (max 5 words) and a short supporting line (max 14 words).
3. One "cta" section — a confident call-to-action headline (max 6 words) and a short line reinforcing cash-on-delivery / easy ordering (max 14 words).

Keep every line short — this is text overlaid on an image, not a paragraph. Do not invent product claims not supported by the description, and do NOT invent promotions, discounts, "free delivery", or time-limited/urgency claims ("offer ends soon", "limited stock", countdowns, etc.) unless they are explicitly stated in the description above — cash-on-delivery and easy ordering are the only claims safe to make without support from the description.`

    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          role: { type: 'STRING', enum: ['hero', 'feature', 'cta'] },
          headline: { type: 'STRING' },
          body: { type: 'STRING' }
        },
        required: ['role', 'headline', 'body']
      }
    }

    const json = await this.post(TEXT_MODEL, apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    })

    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
    if (!text) throw new BadGatewayException('Gemini returned no copy for this product.')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new BadGatewayException('Gemini returned copy in an unexpected format.')
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadGatewayException('Gemini returned no usable copy for this product.')
    }
    return parsed as DraftedSection[]
  }

  // Admin product editor's "generate with AI" — turns a raw, messy content
  // dump (title/description/specs/FAQ all mixed together, any language,
  // admin-pasted) plus optionally some of the product's own photos into a
  // polished, conversion-focused name/description/keyBenefits/faqs/
  // specifications draft. Same free TEXT_MODEL + structured-JSON-output
  // approach as draftSectionCopy, just admin-editor-facing rather than
  // landing-page-facing. Drafts from what was actually given (raw content +
  // photos), never invents specs or claims beyond that.
  async draftProductContent(input: { rawContent: string; sourceImages: InlineImage[]; instructions?: string }): Promise<DraftedProductContent> {
    const apiKey = this.requireApiKey()

    const prompt = `You are turning a store owner's raw, messy product notes into polished, high-converting product page content for a cash-on-delivery (COD) e-commerce store. The raw notes below may mix a title, description, specifications, and FAQ together in any order and any language (Arabic, English, French, or mixed) — infer what each part is even where it isn't labeled.

Raw notes:
"""
${input.rawContent}
"""
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely — they override the defaults below where they conflict): ${input.instructions}\n` : ''}
Write the output in Arabic (this store's storefront is Arabic-only), unless the instructions above explicitly ask for a different language.

Produce:
- name: a short, clear, benefit-forward product title (max 12 words). Not clickbait, not ALL CAPS.
- description: SHORT and scannable (roughly 120-220 words), written to convert a COD shopper skimming on their phone — lead with the single strongest benefit, keep sentences short, close by reinforcing that ordering is easy and risk-free (pay only when it arrives).
- keyBenefits: 3-6 short punchy bullet points (max 12 words each) — the strongest concrete reasons to buy, drawn straight from the raw notes.
- faqs: 3-6 question/answer pairs a hesitant buyer would actually ask before ordering (shipping, payment, returns, product doubts) — answer only from what's in the raw notes or the photos; skip a question entirely rather than inventing an answer the notes don't support.
- specifications: every concrete spec/attribute mentioned in the raw notes (material, size, weight, capacity, contents, compatibility, etc.) as label/value pairs — return an empty array if the notes have no concrete specs, don't invent any.

Do not invent product claims, promotions, discounts, "free delivery", or time-limited/urgency claims ("offer ends soon", "limited stock", countdowns, etc.) that aren't in the raw notes — cash-on-delivery and easy ordering are the only claims safe to add without support from the notes. Every field should genuinely help push a hesitant shopper to place the order, not just fill space.`

    const schema = {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        description: { type: 'STRING' },
        keyBenefits: { type: 'ARRAY', items: { type: 'STRING' } },
        faqs: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
            required: ['question', 'answer']
          }
        },
        specifications: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: { label: { type: 'STRING' }, value: { type: 'STRING' } },
            required: ['label', 'value']
          }
        }
      },
      required: ['name', 'description', 'keyBenefits', 'faqs', 'specifications']
    }

    const parts: Record<string, unknown>[] = [{ text: prompt }]
    for (const image of input.sourceImages) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
    }

    const json = await this.post(TEXT_MODEL, apiKey, {
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    })

    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
    if (!text) throw new BadGatewayException('Gemini returned no content for this product.')

    try {
      return JSON.parse(text) as DraftedProductContent
    } catch {
      throw new BadGatewayException('Gemini returned content in an unexpected format.')
    }
  }

  // "Improve with AI" on the landing-page generation form's "description to
  // generate from" field. Pure text in, text out — no product/DB access at
  // all, so there's nothing here that could write back to Product.
  // description or any other product content. This is deliberately NOT the
  // same job as draftSectionCopy/draftProductContent (which condense into
  // short punchy ad copy) — this is the step BEFORE that: it improves the
  // raw source material a later copy-drafting pass will pull from, so it's
  // told to keep (or add) detail, never shorten or drop it.
  async improveLandingPageDescription(input: { text: string; productName?: string; instructions?: string }): Promise<string> {
    const apiKey = this.requireApiKey()

    const prompt = `You are improving raw product information that will be used as SOURCE MATERIAL for a later step that drafts short landing-page ad copy — this step is NOT that step, so do not condense this into ad copy.

${input.productName ? `Product: ${input.productName}\n` : ''}Raw product information:
"""
${input.text}
"""
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely): ${input.instructions}\n` : ''}
Improve this text: fix grammar and clarity, organize it so the description, specifications, and FAQ parts are easy to tell apart, and make the product's real benefits clearer and more concrete. Do not invent new specs, claims, or FAQ entries that aren't implied by the original text, and do not shorten it or drop concrete details — keep (or add clarity to) as much genuine detail as possible, since the later step needs rich material to draft from. Preserve whatever language(s) the original text already uses.`

    const schema = { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] }

    const json = await this.post(TEXT_MODEL, apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
    })

    const responseText = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
    if (!responseText) throw new BadGatewayException('Gemini returned no improved text.')

    try {
      const parsed = JSON.parse(responseText) as { text?: unknown }
      if (typeof parsed.text !== 'string' || !parsed.text.trim()) {
        throw new Error('missing text')
      }
      return parsed.text
    } catch {
      throw new BadGatewayException('Gemini returned text in an unexpected format.')
    }
  }

  private async requestImage(parts: Record<string, unknown>[]): Promise<InlineImage> {
    const apiKey = this.requireApiKey()
    const json = await this.post(IMAGE_MODEL, apiKey, {
      contents: [{ parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    })
    const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
    if (!inline) {
      const finishReason = json.candidates?.[0]?.finishReason
      throw new BadGatewayException(`Gemini did not return an image${finishReason ? ` (finishReason: ${finishReason})` : ''}.`)
    }
    return { base64: inline.data, mimeType: inline.mimeType }
  }

  // Composes ALL of the product's selected photos and ALL of the drafted
  // section copy into ONE long, vertical landing-page image in a single
  // model call — the same way a store owner driving Gemini by hand gets a
  // one-image result (one prompt, every section described in it, one output
  // image), rather than generating N separate section images and stitching
  // them together after the fact with sharp. This is also the main cost
  // lever for this feature: Gemini's image-output pricing is dominated by a
  // flat per-generated-image cost, not by resolution or prompt length, so
  // one call producing the whole page costs roughly 1/N of the old
  // N-calls-then-stitch approach for an N-section page.
  async generateLandingPageImage(input: {
    sections: { role: 'hero' | 'feature' | 'cta'; headline: string; body: string }[]
    sourceImages: InlineImage[]
    instructions?: string
  }): Promise<InlineImage> {
    const styleByRole: Record<'hero' | 'feature' | 'cta', string> = {
      hero: 'bold, attention-grabbing — dramatic lighting or a vivid gradient background behind the product, large dominant headline',
      feature: 'clean, product-focused, generous white space, a small icon or badge visually representing the benefit next to the headline',
      cta: 'confident call-to-action — a strong accent color block or button-style graphic, a "cash on delivery" / easy-ordering visual cue. No countdown timers, "limited stock", "offer expires", or other fabricated urgency graphics.'
    }
    const sectionBriefs = input.sections
      .map((s, i) => `${i + 1}. [${s.role.toUpperCase()}] Headline: "${s.headline}" — Supporting text: "${s.body}". Style: ${styleByRole[s.role]}`)
      .join('\n')

    const sourceImageCount = input.sourceImages.length
    const useAllPhotosInstruction =
      sourceImageCount > 1
        ? `You have been given ${sourceImageCount} real product reference photos — draw on all of them across the different sections below (not just one of them) so the finished page shows the actual product, not an invented one.`
        : `Use the attached product photo as the actual product shown throughout the image — do not invent a different-looking product.`

    const prompt = `Create ONE single professional e-commerce marketing image: a complete long-scroll landing page for a cash-on-delivery product ad (the AliExpress/TikTok-ad style single-image funnel). Portrait/vertical orientation, a tall aspect ratio, with ALL of the sections below stacked top to bottom INSIDE THIS ONE IMAGE as one seamless, continuous composition — not separate panels, tiles, or a collage, and no visible seams/borders/gaps between sections.

${useAllPhotosInstruction} Do not replace, redesign, or reinvent the product itself, only the background/composition/effects around it.

Sections, in order top to bottom:
${sectionBriefs}

Overlay each section's headline and supporting text directly into the image at that section, cleanly and legibly, in one consistent modern sans-serif style used throughout the whole page.
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely): ${input.instructions}\n` : ''}
High-quality advertising photography look throughout, no watermarks, no placeholder text other than what's specified above. Output exactly ONE image containing the entire page.`

    const parts: Record<string, unknown>[] = [{ text: prompt }]
    for (const image of input.sourceImages) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
    }
    return this.requestImage(parts)
  }

  // Edits the already-generated full landing-page image in place — used
  // when the admin regenerates ONE section (with or without instructions)
  // without wanting to redo the whole page. The previous full image is the
  // primary reference; the model is told to touch only the named section
  // and leave the rest of the page pixel-for-pixel alone.
  async editLandingPageImage(input: {
    currentImage: InlineImage
    targetSection: { role: 'hero' | 'feature' | 'cta'; headline: string; body: string }
    instructions?: string
    sourceImages: InlineImage[]
  }): Promise<InlineImage> {
    const sourceImageCount = input.sourceImages.length
    const prompt = `The first attached image is a complete long-scroll e-commerce landing page (multiple sections stacked vertically in one image). Edit ONLY the section with the headline "${input.targetSection.headline}" (supporting text: "${input.targetSection.body}") — keep every other section, the overall layout, and the image's dimensions exactly unchanged.

${input.instructions ? `Instructions for this section: "${input.instructions}"` : 'Give this section a fresh take, keeping its headline, supporting text, and role the same.'}

The remaining attached image(s) are the real product photo(s) for reference — keep the product itself accurate to them.${sourceImageCount > 1 ? ` There are ${sourceImageCount} of them.` : ''} Output ONE image, same dimensions and orientation as the input, with only that one section changed.`

    const parts: Record<string, unknown>[] = [
      { text: prompt },
      { inlineData: { mimeType: input.currentImage.mimeType, data: input.currentImage.base64 } }
    ]
    for (const image of input.sourceImages) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
    }
    return this.requestImage(parts)
  }
}
