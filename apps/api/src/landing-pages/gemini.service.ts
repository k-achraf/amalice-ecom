import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { LandingLanguage } from '@amalice/shared'
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

export interface ProductBrief {
  category: string
  audience: string
  benefits: string[]
  objections: string[]
  sceneKeywords: string
  tone: string
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

// Talks to Gemini for the admin AI features:
//  - the landing page builder: analyzeProduct → draftSectionCopy → proofreadCopy
//    (text), generateScene + checkScene (a text-free background, vision-checked).
//    The copy is validated in code (landing-copy.util.ts) and drawn by code
//    (landing-page-render.util.ts): the image model never draws text or the
//    product, which is what caused misspelled Arabic and distorted products;
//  - draftLandingCopy for a funnel's native page;
//  - draftProductContent, the product editor's "generate with AI" drafter, and
//    improveLandingPageDescription.
// Requests are retried with backoff on 429/5xx (the free tier rate-limits).
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

  // Gemini's free tier rate-limits (429) and sometimes answers 5xx under load:
  // retried with backoff, so a busy moment doesn't fail a whole page.
  private async post(model: string, apiKey: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500 * attempt))
      let response: Response
      try {
        response = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90_000)
        })
      } catch (error) {
        lastError = new BadGatewayException(`Could not reach the Gemini API: ${(error as Error).message}`)
        continue
      }

      const json = (await response.json().catch(() => ({}))) as GeminiResponse
      if (response.status === 429 || response.status >= 500) {
        lastError = new BadGatewayException(`Gemini API error: ${json.error?.message ?? `HTTP ${response.status}`}`)
        continue
      }
      if (!response.ok) {
        throw new BadGatewayException(`Gemini API error: ${json.error?.message ?? `HTTP ${response.status}`}`)
      }
      if (json.promptFeedback?.blockReason) {
        throw new BadGatewayException(`Gemini blocked the request: ${json.promptFeedback.blockReason}`)
      }
      return json
    }
    throw lastError ?? new BadGatewayException('Gemini request failed.')
  }

  private async generateJson<T>(prompt: string, schema: Record<string, unknown>, extraParts: Record<string, unknown>[] = [], temperature = 0.6): Promise<T> {
    const apiKey = this.requireApiKey()
    const json = await this.post(TEXT_MODEL, apiKey, {
      contents: [{ parts: [{ text: prompt }, ...extraParts] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature }
    })
    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
    if (!text) throw new BadGatewayException('Gemini returned no content.')
    try {
      return JSON.parse(text) as T
    } catch {
      throw new BadGatewayException('Gemini returned content in an unexpected format.')
    }
  }

  private languageRule(language: LandingLanguage, instructions?: string): string {
    const override = instructions ? ' Unless the store owner\'s instructions explicitly ask for another language, ' : ' '
    if (language === 'ar') {
      return `STRICT LANGUAGE REQUIREMENT: write everything in formal Modern Standard Arabic (الفصحى) ONLY — this storefront is Arabic-only.${override}never use colloquial/dialect words or expressions (Algerian, Gulf, Egyptian, Levantine…), slang, transliterated French/English words, or internet-Arabic. Use correct spelling with the hamza and ta marbuta written properly. Do not use diacritics (tashkeel), emoji, or decorative symbols.`
    }
    if (language === 'fr') return 'STRICT LANGUAGE REQUIREMENT: write everything in clear, correct standard French. No slang, no emoji.'
    return 'STRICT LANGUAGE REQUIREMENT: write everything in clear, correct English. No slang, no emoji.'
  }

  // Step 1 — understand the product before writing anything: what it is, who
  // buys it, which real benefits the source supports, what a hesitant buyer
  // worries about, and what kind of background scene suits it. Writing from this
  // brief (instead of straight from the raw text) is what keeps the copy specific
  // and on-topic.
  async analyzeProduct(input: { productName: string; description: string; photos?: InlineImage[]; instructions?: string }): Promise<ProductBrief> {
    const prompt = `You are a senior e-commerce copywriter preparing to write landing-page copy for a cash-on-delivery store in Algeria. First ANALYZE the product — do not write copy yet.

Product name: ${input.productName}
Product information (the ONLY source of truth):
"""
${input.description}
"""
${input.instructions ? `\nStore owner's instructions: ${input.instructions}\n` : ''}${input.photos?.length ? '\nThe attached photos show the real product.\n' : ''}
Return:
- category: what kind of product this is, in a few English words.
- audience: who typically buys it and why, one English sentence.
- benefits: 3-5 of the strongest benefits or features that are EXPLICITLY supported by the product information (each as a short phrase in the language of the source). Never invent any.
- objections: 2-3 doubts a hesitant buyer would have (quality, size, how it works…), based on the product type.
- sceneKeywords: 8-14 ENGLISH words describing a fitting, tasteful background scene for advertising this product (setting, materials, lighting, mood) — NO text, NO people's faces, NO brand names.
- tone: one English phrase for the right voice (e.g. "warm and reassuring", "energetic and modern").`
    const schema = {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING' },
        audience: { type: 'STRING' },
        benefits: { type: 'ARRAY', items: { type: 'STRING' } },
        objections: { type: 'ARRAY', items: { type: 'STRING' } },
        sceneKeywords: { type: 'STRING' },
        tone: { type: 'STRING' }
      },
      required: ['category', 'audience', 'benefits', 'objections', 'sceneKeywords', 'tone']
    }
    const parts = (input.photos ?? []).slice(0, 3).map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.base64 } }))
    return this.generateJson<ProductBrief>(prompt, schema, parts, 0.3)
  }

  // Step 2 — draft the section copy from the brief. `feedback` carries the
  // concrete problems validation found in the previous attempt, so a retry fixes
  // them instead of rolling the dice again.
  async draftSectionCopy(input: {
    productName: string
    description: string
    sectionCount: number
    language: LandingLanguage
    brief?: ProductBrief
    instructions?: string
    feedback?: string[]
    previous?: DraftedSection[]
  }): Promise<DraftedSection[]> {
    const featureCount = Math.max(1, input.sectionCount - 2)
    const prompt = `You are writing the text of a long-scroll landing page (AliExpress/TikTok-ad style) for a cash-on-delivery e-commerce product. The text is drawn by code over images, so it must be short, complete, and perfectly spelled.

Product: ${input.productName}
Product information (the ONLY source of truth):
"""
${input.description}
"""
${input.brief ? `\nProduct analysis — category: ${input.brief.category}. Audience: ${input.brief.audience}. Strongest supported benefits: ${input.brief.benefits.join(' | ')}. Buyer doubts to ease: ${input.brief.objections.join(' | ')}. Voice: ${input.brief.tone}.\n` : ''}${input.instructions ? `\nStore owner's instructions (follow closely — they override the defaults where they conflict): ${input.instructions}\n` : ''}
${this.languageRule(input.language, input.instructions)}

Write exactly ${input.sectionCount} sections in this order:
1. One "hero" — a bold headline (max 6 words) naming the product's single strongest benefit, plus one short supporting line (max 12 words).
2. ${featureCount} "feature" section(s) — each about ONE distinct, SPECIFIC benefit or feature present in the product information (never a generic claim that could describe any product); headline max 5 words, supporting line max 14 words. Each feature must be different from the others.
3. One "cta" — a confident call-to-action headline (max 6 words) and a short line (max 14 words) about easy ordering and paying only on delivery.

Rules: every line must be a complete, natural phrase (never cut off, no trailing ellipsis). Do not invent specs, numbers, prices, promotions, discounts, "free delivery", guarantees, awards, or urgency ("limited stock", "offer ends") — only what the product information states; cash-on-delivery and easy ordering are the only claims allowed without support. If the information has too few distinct points for ${featureCount} features, rephrase the strongest points differently rather than inventing new ones. No emoji, no quotation marks, no ALL CAPS, no hashtags.
${input.feedback?.length ? `\nYour previous attempt was REJECTED for these problems — fix every one of them:\n${input.feedback.map((f) => `- ${f}`).join('\n')}\nPrevious attempt:\n${JSON.stringify(input.previous ?? [])}\n` : ''}`

    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { role: { type: 'STRING', enum: ['hero', 'feature', 'cta'] }, headline: { type: 'STRING' }, body: { type: 'STRING' } },
        required: ['role', 'headline', 'body']
      }
    }
    const parsed = await this.generateJson<DraftedSection[]>(prompt, schema, [], input.feedback?.length ? 0.4 : 0.7)
    if (!Array.isArray(parsed) || parsed.length === 0) throw new BadGatewayException('Gemini returned no usable copy for this product.')
    return parsed
  }

  // Step 3 — a dedicated proofreading pass: spelling, grammar, wording. Same
  // meaning and length, no new claims.
  async proofreadCopy(input: { sections: DraftedSection[]; language: LandingLanguage }): Promise<DraftedSection[]> {
    const prompt = `You are a meticulous native-level proofreader. Below is landing-page copy in ${input.language === 'ar' ? 'Modern Standard Arabic' : input.language === 'fr' ? 'French' : 'English'}. Fix ONLY: spelling mistakes, wrong letters or word forms, grammar, punctuation, awkward or unnatural phrasing, and any dialect words (replace them with the formal equivalent). Keep each section's role, meaning, and approximate length. Do NOT add new claims, numbers, or promotions, and do not lengthen the lines. Return the same ${input.sections.length} sections in the same order. If a line is already correct, return it unchanged.

${JSON.stringify(input.sections)}`
    const schema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { role: { type: 'STRING', enum: ['hero', 'feature', 'cta'] }, headline: { type: 'STRING' }, body: { type: 'STRING' } },
        required: ['role', 'headline', 'body']
      }
    }
    const parsed = await this.generateJson<DraftedSection[]>(prompt, schema, [], 0.1)
    if (!Array.isArray(parsed) || parsed.length !== input.sections.length) throw new BadGatewayException('Proofreading returned an unexpected result.')
    return parsed
  }

  // Native funnel landing page copy: a headline, a subheadline and a button label.
  async draftLandingCopy(input: { productName: string; description: string; language: LandingLanguage; brief?: ProductBrief; instructions?: string; feedback?: string[] }): Promise<{ headline: string; subheadline: string; ctaLabel: string }> {
    const prompt = `Write the top-of-page copy for a one-product cash-on-delivery landing page.

Product: ${input.productName}
Product information (the ONLY source of truth):
"""
${input.description}
"""
${input.brief ? `\nProduct analysis — audience: ${input.brief.audience}. Supported benefits: ${input.brief.benefits.join(' | ')}. Voice: ${input.brief.tone}.\n` : ''}${input.instructions ? `\nStore owner's instructions: ${input.instructions}\n` : ''}
${this.languageRule(input.language, input.instructions)}

Return:
- headline: max 9 words, names the main benefit for the buyer, complete and natural.
- subheadline: one sentence, max 22 words, adds the most convincing supported detail.
- ctaLabel: the order button text, max 5 words, mentioning ordering (e.g. order now, pay on delivery).
Never invent specs, numbers, promotions, discounts, free delivery, guarantees or urgency not stated in the product information. No emoji, no quotation marks.${input.feedback?.length ? `\n\nYour previous attempt was rejected for:\n${input.feedback.map((f) => `- ${f}`).join('\n')}\nFix all of them.` : ''}`
    const schema = {
      type: 'OBJECT',
      properties: { headline: { type: 'STRING' }, subheadline: { type: 'STRING' }, ctaLabel: { type: 'STRING' } },
      required: ['headline', 'subheadline', 'ctaLabel']
    }
    return this.generateJson(prompt, schema, [], 0.6)
  }

  // Admin product editor's "generate with AI" — turns a raw, messy content
  // dump (title/description/specs/FAQ all mixed together, any language,
  // admin-pasted) plus optionally some of the product's own photos into a
  // polished, conversion-focused name/description/keyBenefits/faqs/
  // specifications draft. Same free TEXT_MODEL + structured-JSON-output
  // approach as draftSectionCopy, just admin-editor-facing rather than
  // landing-page-facing. Drafts from what was actually given (raw content +
  // photos), never invents specs or claims beyond that.
  async draftProductContent(input: { rawContent: string; sourceImages: InlineImage[]; instructions?: string; language?: LandingLanguage }): Promise<DraftedProductContent> {
    const apiKey = this.requireApiKey()

    const prompt = `You are turning a store owner's raw, messy product notes into polished, high-converting product page content for a cash-on-delivery (COD) e-commerce store. The raw notes below may mix a title, description, specifications, and FAQ together in any order and any language (Arabic, English, French, or mixed) — infer what each part is even where it isn't labeled.

Raw notes:
"""
${input.rawContent}
"""
${input.instructions ? `\nAdditional instructions from the store owner (follow these closely — they override the defaults below where they conflict): ${input.instructions}\n` : ''}
${this.languageRule(input.language ?? 'ar', input.instructions)} This applies to EVERY field: name, description, keyBenefits, faqs and specifications (labels and values), whatever language the raw notes are written in.

Produce:
- name: a short, clear, benefit-forward product title (max 12 words). Not clickbait, not ALL CAPS.
- description: an HTML string (it is loaded into a rich-text editor and shown on the storefront as-is), SHORT and scannable (roughly 120-220 words), written to convert a COD shopper skimming on their phone — lead with the single strongest benefit, keep sentences short, close by reinforcing that ordering is easy and risk-free (pay only when it arrives). Use ONLY these tags: <p>, <h3> (for 1-3 short section headings), <ul>/<li>, <strong>, <em>. No markdown, no code fences, no <html>/<body>, no inline styles, no emoji. Do NOT repeat the key benefits list, FAQ or specifications inside the description — they are shown in their own sections.
- keyBenefits: 3-6 short punchy bullet points (max 12 words each) — the strongest concrete reasons to buy, drawn straight from the raw notes.
- faqs: 3-6 question/answer pairs a hesitant buyer would actually ask before ordering (shipping, payment, returns, product doubts) — answer only from what's in the raw notes or the photos; skip a question entirely rather than inventing an answer the notes don't support.
- specifications: every concrete spec/attribute mentioned in the raw notes (material, size, weight, capacity, contents, compatibility, etc.) as label/value pairs — return an empty array if the notes have no concrete specs, don't invent any.

STRICT GROUNDING REQUIREMENT: every fact, feature, benefit, spec, and claim in your output must come directly from the raw notes above (or be visibly true in the attached photos, if any) — never invent, assume, embellish, or add anything not explicitly present, even if it would be typical or plausible for similar products. If the raw notes don't mention something, leave it out entirely rather than guessing or filling the gap. Do not invent promotions, discounts, "free delivery", or time-limited/urgency claims ("offer ends soon", "limited stock", countdowns, etc.) that aren't in the raw notes — cash-on-delivery and easy ordering are the only claims safe to add without support from the notes. Every field should genuinely help push a hesitant shopper to place the order, not just fill space — but never at the cost of accuracy.`

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
Improve this text: fix grammar and clarity, organize it so the description, specifications, and FAQ parts are easy to tell apart, and make the product's real benefits clearer and more concrete. STRICT GROUNDING REQUIREMENT: do not invent new specs, claims, features, or FAQ entries that aren't explicitly present in the original text — never add anything just because it seems plausible or typical for similar products. Do not shorten it or drop concrete details — keep (or add clarity to) as much genuine detail as possible, since the later step needs rich material to draft from. Preserve whatever language(s) the original text already uses; if it's Arabic, keep it in formal Modern Standard Arabic (الفصحى), not dialect or slang.`

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

  private async requestImage(parts: Record<string, unknown>[], aspectRatio?: string): Promise<InlineImage> {
    const apiKey = this.requireApiKey()
    const run = (generationConfig: Record<string, unknown>) => this.post(IMAGE_MODEL, apiKey, { contents: [{ parts }], generationConfig })
    let json: GeminiResponse
    try {
      json = await run({ responseModalities: ['TEXT', 'IMAGE'], ...(aspectRatio && { imageConfig: { aspectRatio } }) })
    } catch (error) {
      // Some model versions reject imageConfig: retry once without it.
      if (!aspectRatio || !/imageConfig|aspect|Unknown name|Invalid JSON/i.test((error as Error).message)) throw error
      json = await run({ responseModalities: ['TEXT', 'IMAGE'] })
    }
    const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
    if (!inline) {
      const finishReason = json.candidates?.[0]?.finishReason
      throw new BadGatewayException(`Gemini did not return an image${finishReason ? ` (finishReason: ${finishReason})` : ''}.`)
    }
    return { base64: inline.data, mimeType: inline.mimeType }
  }

  // A text-free background scene for one section. The model never draws
  // letters, the product, or a logo: text is drawn by code afterwards (so it can
  // never be misspelled or distorted) and the real product photo is placed on top
  // untouched. Colours follow the page palette so sections look like one design.
  async generateScene(input: {
    role: 'hero' | 'feature' | 'cta'
    sceneKeywords: string
    paletteHint: string
    style: 'vibrant' | 'dark' | 'light'
    instructions?: string
  }): Promise<InlineImage> {
    const mood: Record<typeof input.style, string> = {
      vibrant: 'rich, saturated, energetic but tasteful',
      dark: 'dark, moody, premium, with soft highlights',
      light: 'bright, airy, clean, soft pastel light'
    }
    const roleBrief: Record<typeof input.role, string> = {
      hero: 'a dramatic, high-impact backdrop with depth and soft light, the visual centre clear and empty',
      feature: 'a calm, minimal backdrop with generous empty space and gentle depth',
      cta: 'a confident, warm backdrop with a clear empty centre'
    }
    const prompt = `Create a background image for an e-commerce advertisement.

Scene: ${input.sceneKeywords}. Style: ${mood[input.style]}. Colour palette: ${input.paletteHint}. Composition: ${roleBrief[input.role]}. Portrait orientation, 4:5.

ABSOLUTE RULES: the image must contain NO text of any kind — no letters, numbers, words, signs, labels, captions, logos, watermarks, or symbols that look like writing. NO products, NO packaging, NO people or faces, NO hands. Only an empty, beautiful backdrop (surfaces, textures, light, soft shapes, bokeh, subtle props unrelated to any brand) where a product and text will be placed on top later. The centre and the upper third must stay uncluttered.${input.instructions ? `\nAdditional art direction from the store owner: ${input.instructions}` : ''}`
    return this.requestImage([{ text: prompt }], '4:5')
  }

  // Vision check of a generated scene: reject anything with writing, logos,
  // people/products, or visible distortion — those are exactly the defects that
  // make an AI landing page look broken.
  async checkScene(image: InlineImage): Promise<{ ok: boolean; reasons: string[] }> {
    const prompt = `Inspect this generated background image strictly. It will be used behind headlines and a product photo, so it must be empty of content. Answer each question honestly:
- containsText: is there ANY readable or pseudo-readable text, letters, numbers, logos, watermarks or writing-like marks?
- containsProductOrPerson: is there a main product, packaging, a person, a face or hands?
- looksBroken: are there obvious distortions, warped shapes, melted objects, strange artifacts, or severe noise?
- tooBusy: is the centre or upper third cluttered so text would be hard to read?`
    const schema = {
      type: 'OBJECT',
      properties: {
        containsText: { type: 'BOOLEAN' },
        containsProductOrPerson: { type: 'BOOLEAN' },
        looksBroken: { type: 'BOOLEAN' },
        tooBusy: { type: 'BOOLEAN' }
      },
      required: ['containsText', 'containsProductOrPerson', 'looksBroken', 'tooBusy']
    }
    const result = await this.generateJson<{ containsText: boolean; containsProductOrPerson: boolean; looksBroken: boolean; tooBusy: boolean }>(
      prompt, schema, [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }], 0
    )
    const reasons: string[] = []
    if (result.containsText) reasons.push('contains text or logos')
    if (result.containsProductOrPerson) reasons.push('contains a product or person')
    if (result.looksBroken) reasons.push('looks distorted')
    if (result.tooBusy) reasons.push('too busy behind the text')
    return { ok: reasons.length === 0, reasons }
  }
}
