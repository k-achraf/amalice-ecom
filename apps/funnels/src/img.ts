import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { config } from './config'
import { IMG_WIDTHS, externalImage } from './util'

// Image proxy: product photos are uploaded at camera size; a phone on 4G needs a 480px WebP, not a 3MB JPEG.
// Only /uploads/* paths of our own API are resizable (never an arbitrary URL: that would be an open proxy).
// Results are cached on disk and in memory, and served immutable: an upload's URL never changes content.
const DIR = join(tmpdir(), 'amalice-funnels-img')
const mem = new Map<string, Buffer>()
const MEM_BUDGET = 64 * 1024 * 1024
let memBytes = 0
const inflight = new Map<string, Promise<Buffer>>()

function remember(key: string, buf: Buffer) {
  if (buf.length > 2_000_000) return
  mem.set(key, buf)
  memBytes += buf.length
  // Drop oldest entries (Map keeps insertion order) until back under budget.
  for (const k of mem.keys()) {
    if (memBytes <= MEM_BUDGET) break
    memBytes -= mem.get(k)!.length
    mem.delete(k)
  }
}

export interface ImgResult {
  body: Buffer
  type: string
}

export interface ImgQuery {
  // What to fetch, and what to send the visitor to if resizing fails.
  source: string
  fallback: string
  width: number
}

export function parseImgQuery(url: URL): ImgQuery | null {
  const w = Number(url.searchParams.get('w'))
  const width = IMG_WIDTHS.find((x) => x >= w) ?? IMG_WIDTHS[IMG_WIDTHS.length - 1]!
  const path = url.searchParams.get('u')
  if (path !== null) {
    // Strict: our own uploads folder only, no traversal.
    if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(path)) return null
    return { source: `${config.apiBase}${path}`, fallback: `${config.publicApiBase}${path}`, width }
  }
  // External link: only if it is one we rendered into a page ourselves.
  const ext = externalImage(url.searchParams.get('e') ?? '')
  return ext ? { source: ext, fallback: ext, width } : null
}

const MAX_BYTES = 20 * 1024 * 1024

async function produce(source: string, width: number): Promise<Buffer> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 8000)
  try {
    const res = await fetch(source, { signal: ctl.signal })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('not an image')
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('too large')
    const input = Buffer.from(await res.arrayBuffer())
    if (input.length > MAX_BYTES) throw new Error('too large')
    return await sharp(input, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toBuffer()
  } finally {
    clearTimeout(timer)
  }
}

export async function getImage(source: string, width: number): Promise<ImgResult> {
  const key = createHash('sha1').update(`${source}|${width}`).digest('hex')
  const hit = mem.get(key)
  if (hit) return { body: hit, type: 'image/webp' }

  const file = join(DIR, `${key}.webp`)
  try {
    const disk = await readFile(file)
    remember(key, disk)
    return { body: disk, type: 'image/webp' }
  } catch {
    // not on disk yet
  }

  let job = inflight.get(key)
  if (!job) {
    job = produce(source, width)
      .then(async (buf) => {
        remember(key, buf)
        await mkdir(DIR, { recursive: true }).then(() => writeFile(file, buf)).catch(() => undefined)
        return buf
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, job)
  }
  return { body: await job, type: 'image/webp' }
}
