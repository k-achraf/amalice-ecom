import { join, extname } from 'node:path'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'

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

// Reads an image (local upload or external URL) as a raw buffer.
export async function loadImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('/uploads/')) return fs.readFileSync(join(process.cwd(), url.replace(/^\//, '')))
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`Could not fetch image (${response.status}): ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

// Saves a buffer under /uploads and returns its public path.
export function saveBuffer(buffer: Buffer, ext: '.webp' | '.png' | '.jpg'): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  const filename = `${crypto.randomUUID()}${ext}`
  fs.writeFileSync(join(UPLOADS_DIR, filename), buffer)
  return `/uploads/${filename}`
}
