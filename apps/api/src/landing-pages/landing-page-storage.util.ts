import { join, extname } from 'node:path'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import sharp from 'sharp'

// Same local-disk convention as admin/upload.controller.ts (UPLOADS_DIR,
// served statically at /uploads/) — generated images are just another kind
// of uploaded image as far as storage is concerned.
const UPLOADS_DIR = join(process.cwd(), 'uploads')

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

export function saveGeneratedImage(base64: string, mimeType: string): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  const ext = EXT_BY_MIME[mimeType] ?? '.png'
  const filename = `${crypto.randomUUID()}${ext}`
  fs.writeFileSync(join(UPLOADS_DIR, filename), Buffer.from(base64, 'base64'))
  return `/uploads/${filename}`
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif'
}

// Returns an image (local upload or external URL) as base64 + mime type,
// ready to send to Gemini as inline image data. Local /uploads/ URLs are
// read straight off disk — no point round-tripping an HTTP request to our
// own server for a file we already have; only genuinely external URLs
// (an admin pasted a raw link instead of downloading it first) go over HTTP.
export async function fetchImageAsInline(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('/uploads/')) {
    const filePath = join(process.cwd(), url.replace(/^\//, ''))
    const buffer = fs.readFileSync(filePath)
    const mimeType = MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'image/jpeg'
    return { base64: buffer.toString('base64'), mimeType }
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Could not fetch source image (${response.status}): ${url}`)
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  return { base64: buffer.toString('base64'), mimeType: contentType.split(';')[0] }
}

// Vertically concatenates section images (each already includes its own
// text/effects, baked in by the model) into one long landing-page image.
// Sections may come back from Gemini at slightly different widths — resize
// each to a common width before stacking so the seams line up cleanly.
//
// Output is WebP, not JPEG — this final image is the whole page's LCP
// element (loaded eager/fetchpriority=high on /lp/:slug) and a naive
// vertical stack of 5-7 full-bleed sections at quality 88 JPEG routinely
// landed several MB, which is exactly what made the page slow to load.
// WebP at quality 78 is typically 25-35% smaller than equivalent-quality
// JPEG for this kind of photographic+text content, with no visible
// difference at web viewing sizes.
export async function stitchSectionsVertically(sectionImageUrls: string[], targetWidth = 1024): Promise<string> {
  const buffers = await Promise.all(
    sectionImageUrls.map(async (url) => {
      const path = join(process.cwd(), url.replace(/^\/uploads\//, 'uploads/'))
      return sharp(path).resize({ width: targetWidth }).toBuffer()
    })
  )

  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()))
  const totalHeight = metas.reduce((sum, m) => sum + (m.height ?? 0), 0)

  let offsetY = 0
  const composite: { input: Buffer; top: number; left: number }[] = []
  for (let i = 0; i < buffers.length; i++) {
    composite.push({ input: buffers[i], top: offsetY, left: 0 })
    offsetY += metas[i].height ?? 0
  }

  const finalBuffer = await sharp({
    create: { width: targetWidth, height: totalHeight, channels: 3, background: '#ffffff' }
  })
    .composite(composite)
    .webp({ quality: 78, effort: 4 })
    .toBuffer()

  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  const filename = `${crypto.randomUUID()}.webp`
  fs.writeFileSync(join(UPLOADS_DIR, filename), finalBuffer)
  return `/uploads/${filename}`
}
