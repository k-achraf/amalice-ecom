import { BadGatewayException, Injectable } from '@nestjs/common'
import type { InlineImage } from './gemini.service'
import { overlayTextOnImage } from './text-overlay.util'

// Pollinations.ai — free, keyless, text-to-image. Alternative to Gemini's
// Nano Banana for the AI landing page builder (gemini.service.ts) when
// Google Cloud billing isn't set up: no API key, no billing, no signup.
// Two real tradeoffs vs Gemini, both structural to the service itself:
//  - Text-to-image only — it can't take the product's own photos as a
//    reference, so it generates a generic product-style image rather than
//    editing the real ones.
//  - No reliable on-image text rendering — headline/body are composited on
//    afterwards in code (text-overlay.util.ts) instead of drawn by the model.
const IMAGE_BASE = 'https://image.pollinations.ai/prompt'
const SECTION_WIDTH = 1024
const SECTION_HEIGHT = 1536

@Injectable()
export class PollinationsService {
  async generateSectionImage(input: {
    role: 'hero' | 'feature' | 'cta'
    headline: string
    body: string
    productName: string
  }): Promise<InlineImage> {
    const styleByRole: Record<typeof input.role, string> = {
      hero: 'dramatic professional product advertising photography, bold vivid gradient background, dramatic lighting',
      feature: 'clean minimalist product photography, soft studio lighting, generous negative space',
      cta: 'bold vibrant promotional photography, strong accent-colored background, energetic composition'
    }

    const prompt = `${input.productName}, ${styleByRole[input.role]}, high quality e-commerce advertising photo, no text, no watermark, no logo`
    const seed = Math.floor(Math.random() * 1_000_000)
    const url = `${IMAGE_BASE}/${encodeURIComponent(prompt)}?width=${SECTION_WIDTH}&height=${SECTION_HEIGHT}&nologo=true&seed=${seed}`

    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    } catch (error) {
      throw new BadGatewayException(`Could not reach the Pollinations API: ${(error as Error).message}`)
    }
    if (!response.ok) {
      throw new BadGatewayException(`Pollinations API error: HTTP ${response.status}`)
    }

    const raw = Buffer.from(await response.arrayBuffer())
    const composed = await overlayTextOnImage(raw, { role: input.role, headline: input.headline, body: input.body })
    return { base64: composed.toString('base64'), mimeType: 'image/jpeg' }
  }
}
