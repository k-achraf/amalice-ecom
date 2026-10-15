import { BadGatewayException, Injectable } from '@nestjs/common'

// Pollinations.ai — free, keyless text-to-image. Used as an alternative source of
// the text-free background scenes when Gemini's image model isn't available (it
// needs Google Cloud billing). It only ever produces BACKGROUNDS: all copy is
// drawn by code (landing-page-render.util.ts) and the product's real photo is
// placed on top, so its inability to render text or reuse photos doesn't matter.
const IMAGE_BASE = 'https://image.pollinations.ai/prompt'

@Injectable()
export class PollinationsService {
  async generateScene(input: { sceneKeywords: string; role: 'hero' | 'feature' | 'cta'; instructions?: string }): Promise<{ base64: string; mimeType: string }> {
    const mood = { hero: 'dramatic soft lighting, depth', feature: 'calm minimal, generous empty space', cta: 'warm confident, empty centre' }[input.role]
    const prompt = `empty advertising background, ${input.sceneKeywords}, ${mood}${input.instructions ? `, ${input.instructions}` : ''}, no text, no letters, no logo, no watermark, no product, no people, high quality, portrait`
    const seed = Math.floor(Math.random() * 1_000_000)
    const url = `${IMAGE_BASE}/${encodeURIComponent(prompt)}?width=1024&height=1280&nologo=true&seed=${seed}`

    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    } catch (error) {
      throw new BadGatewayException(`Could not reach the Pollinations API: ${(error as Error).message}`)
    }
    if (!response.ok) throw new BadGatewayException(`Pollinations API error: HTTP ${response.status}`)
    return { base64: Buffer.from(await response.arrayBuffer()).toString('base64'), mimeType: response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg' }
  }
}
