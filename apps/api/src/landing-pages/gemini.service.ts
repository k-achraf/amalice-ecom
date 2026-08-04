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

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

// Talks to Gemini for the AI landing page builder (packages/shared/src/
// landing-page.ts): one text call drafts per-section marketing copy from
// the raw product description, one image call per section composes the
// product's own photos into a styled, text-and-effects section image.
// LandingPagesProcessor stitches the resulting section images together.
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
3. One "cta" section — a call-to-action headline creating urgency (max 6 words) and a short line reinforcing cash-on-delivery / easy ordering (max 14 words).

Keep every line short — this is text overlaid on an image, not a paragraph. Do not invent product claims not supported by the description.`

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

  // Composes 1+ of the product's own photos into one styled section image
  // with the given copy and role-appropriate visual effects baked in by the
  // model itself (not overlaid after the fact — Gemini 2.5 Flash Image is
  // one of the few free-tier models that renders legible on-image text
  // reliably, which is why it was chosen for this feature).
  async generateSectionImage(input: {
    role: 'hero' | 'feature' | 'cta'
    headline: string
    body: string
    sourceImages: InlineImage[]
    // Freeform art-direction from the store owner — appended to the prompt
    // whether this is a fresh generation or an edit (below).
    instructions?: string
    // When set, this is an EDIT of an already-generated section image
    // (regenerateSection with instructions) rather than a from-scratch
    // composition: the previous image is sent as the primary reference and
    // the model is told to modify it per `instructions`, keeping everything
    // else the same. The original product photos are still attached too, so
    // the model can still check itself against the real product.
    editImage?: InlineImage
  }): Promise<InlineImage> {
    const apiKey = this.requireApiKey()

    const styleByRole: Record<typeof input.role, string> = {
      hero: 'Bold, attention-grabbing hero banner. Dramatic lighting or a vivid gradient background behind the product. The headline should be large and dominant.',
      feature: 'Clean, product-focused layout with generous white space. Add a small icon or badge visually representing the benefit next to the headline.',
      cta: 'Urgency-driven call-to-action banner. Use a strong accent color block or button-style graphic. Include a "cash on delivery" / easy-ordering visual cue.'
    }

    const prompt = input.editImage
      ? `The first attached image is a previously generated e-commerce landing-page section. Edit it according to these instructions, keeping everything else about the composition, text, and product unchanged unless the instructions say otherwise:

Instructions: "${input.instructions}"

The remaining attached image(s) are the real product photo(s) for reference — keep the product itself accurate to them. Keep the existing overlaid text ("${input.headline}" / "${input.body}") unless the instructions ask to change it. Output ONE image, same portrait/vertical orientation, same high-quality advertising photography look.`
      : `Create ONE professional e-commerce marketing image, portrait/vertical orientation, for one section of a product landing page.

Use the attached product photo(s) as the actual product shown in the image — do not replace, redesign, or reinvent the product itself, only the background/composition/effects around it.

Section style: ${styleByRole[input.role]}
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely): ${input.instructions}\n` : ''}
Overlay this text directly into the image, cleanly and legibly, in a modern sans-serif style that fits the composition:
Headline: "${input.headline}"
Supporting text: "${input.body}"

High-quality advertising photography look, no watermarks, no placeholder text other than what's specified above.`

    const parts: Record<string, unknown>[] = [{ text: prompt }]
    if (input.editImage) {
      parts.push({ inlineData: { mimeType: input.editImage.mimeType, data: input.editImage.base64 } })
    }
    for (const image of input.sourceImages) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
    }

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
}
