import { join } from 'node:path'
import sharp from 'sharp'
import type { LandingLanguage, LandingStyle } from '@amalice/shared'
import { CTA_BUTTON } from './landing-copy.util'

// Composes one landing-page section in code: the product's own (enhanced) photo
// is the section, full width, and the copy is drawn directly on it as real text
// with the bundled Cairo font (Arabic shaping + right-to-left handled by
// Pango/HarfBuzz) over a gradient that keeps it readable. The AI never draws
// letters, so text can't be misspelled or garbled — and a copy edit re-renders
// in under a second with no AI call.

const W = 1080
const FONT_FILE = join(process.cwd(), 'assets', 'fonts', 'Cairo-Variable.ttf')
const PAD = 90
const TEXT_W = W - PAD * 2

export interface Palette {
  accent: string
  accentDark: string
  accentLight: string
  ink: string
  paper: string
}

// ---- colour helpers ----

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

// The store's own teal, used when the product photo has no usable colour (white
// or grey products on white backgrounds are common).
const FALLBACK_ACCENT = '#1f5f5b'

export async function accentFromPhoto(photo: Buffer | undefined): Promise<string> {
  if (!photo) return FALLBACK_ACCENT
  try {
    // Downscale first: stats on a tiny version is faster and ignores fine noise.
    const small = await sharp(photo).resize(64, 64, { fit: 'inside' }).removeAlpha().toBuffer()
    const stats = await sharp(small).stats()
    const { r, g, b } = stats.dominant
    const [h, s, l] = rgbToHsl(r, g, b)
    if (s < 0.22 || l > 0.92 || l < 0.06) return FALLBACK_ACCENT
    return hslToHex(h, Math.min(0.78, Math.max(0.5, s)), 0.4)
  } catch {
    return FALLBACK_ACCENT
  }
}

export function buildPalette(accentHex: string): Palette {
  const [r, g, b] = hexToRgb(accentHex)
  const [h, s] = rgbToHsl(r, g, b)
  return {
    accent: accentHex,
    accentDark: hslToHex(h, Math.min(0.7, s), 0.14),
    accentLight: hslToHex(h, 0.55, 0.94),
    ink: hslToHex(h, 0.35, 0.1),
    paper: '#fbfaf7'
  }
}

// ---- text ----

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface Img { buf: Buffer; w: number; h: number }

async function textImg(text: string, o: { size: number; weight: 'bold' | 'regular'; color: string; width: number; align?: 'centre' | 'left' | 'right'; spacing?: number }): Promise<Img> {
  const markup = `<span foreground="${o.color}" font_weight="${o.weight === 'bold' ? 800 : 500}">${esc(text)}</span>`
  const buf = await sharp({
    text: { text: markup, font: `Cairo ${o.size}`, fontfile: FONT_FILE, width: o.width, align: o.align ?? 'centre', rgba: true, wrap: 'word', spacing: o.spacing ?? 6 }
  }).png().toBuffer()
  const m = await sharp(buf).metadata()
  return { buf, w: m.width ?? 0, h: m.height ?? 0 }
}

// ---- photo preparation ----

// Deterministic clean-up of a product photo, always applied (before any AI edit):
// upright, auto-levels, a touch of colour and sharpness, and upscaled when the
// photo is too small for a 1080px-wide page.
export async function enhanceLocal(photo: Buffer): Promise<Buffer> {
  const upright = await sharp(photo).rotate().flatten({ background: '#ffffff' }).toBuffer()
  const meta = await sharp(upright).metadata()
  let img = sharp(upright).normalise({ lower: 1, upper: 99 }).modulate({ saturation: 1.07 })
  if ((meta.width ?? W) < 1400) img = img.resize({ width: 1400, kernel: 'lanczos3', withoutEnlargement: false })
  return img.sharpen({ sigma: 0.9, m1: 0.8, m2: 2 }).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer()
}

// ---- section layouts ----

export interface RenderInput {
  role: 'hero' | 'feature' | 'cta'
  index: number
  featureNumber: number
  headline: string
  body: string
  language: LandingLanguage
  style: LandingStyle
  palette: Palette
  // The prepared (enhanced) photo of this section.
  photo: Buffer
}

const BADGE: Record<LandingLanguage, string> = { ar: 'الدفع عند الاستلام', fr: 'Paiement à la livraison', en: 'Pay on delivery' }

// Photo height per role; the text block reaches OVERLAP px up over the photo and
// FADE px of gradient lead into it.
const PHOTO_H = { hero: 1350, feature: 1200, cta: 1150 } as const
const OVERLAP = 300
const FADE = 220
const EDGE = 90

export async function renderSection(input: RenderInput): Promise<Buffer> {
  const p = input.palette
  const light = input.style === 'light'
  const textColor = light ? p.ink : '#ffffff'
  const softColor = light ? '#2f3b3a' : '#eef3f3'
  const scrim = light ? '#ffffff' : input.style === 'dark' ? '#0b0f12' : p.accentDark
  const solid = light ? 0.93 : 0.9
  // Alternate features put their text above the photo instead of below it.
  const textOnTop = input.role === 'feature' && input.index % 2 === 0
  const photoH = PHOTO_H[input.role]
  const center = (w: number) => Math.round((W - w) / 2)

  // ---- the text block, measured ----
  const parts: { buf: Buffer; w: number; h: number; gap: number }[] = []
  const add = (img: Img, gap: number) => parts.push({ ...img, gap })
  const sizes = input.role === 'feature' ? { h: 74, b: 44 } : { h: input.role === 'hero' ? 88 : 84, b: 46 }

  if (input.role === 'feature') {
    const size = 96
    const num = await textImg(String(input.featureNumber), { size: 52, weight: 'bold', color: light ? '#ffffff' : p.accentDark, width: size })
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${light ? p.accent : '#ffffff'}"/></svg>`)
    const badge = await sharp(circle).composite([{ input: num.buf, top: Math.round((size - num.h) / 2) - 2, left: Math.round((size - num.w) / 2) }]).png().toBuffer()
    add({ buf: badge, w: size, h: size }, 36)
  }
  add(await textImg(input.headline, { size: sizes.h, weight: 'bold', color: textColor, width: TEXT_W, spacing: -16 }), 26)
  add(await textImg(input.body, { size: sizes.b, weight: 'regular', color: softColor, width: TEXT_W - 50, spacing: -8 }), 0)

  if (input.role === 'cta') {
    const label = await textImg(CTA_BUTTON[input.language], { size: 52, weight: 'bold', color: light || input.style === 'dark' ? '#ffffff' : p.accentDark, width: TEXT_W - 80 })
    const bw = Math.min(W - PAD * 2, Math.max(label.w + 120, 700))
    const bh = label.h + 64
    const fill = light || input.style === 'dark' ? p.accent : '#ffffff'
    const svg = Buffer.from(`<svg width="${bw}" height="${bh}"><rect width="${bw}" height="${bh}" rx="${bh / 2}" fill="${fill}"/></svg>`)
    const button = await sharp(svg).composite([{ input: label.buf, top: 32, left: Math.round((bw - label.w) / 2) }]).png().toBuffer()
    parts[parts.length - 1]!.gap = 64
    add({ buf: button, w: bw, h: bh }, 0)
  }
  const blockH = parts.reduce((sum, x) => sum + x.h + x.gap, 0)

  // ---- geometry ----
  // Text below: photo on top, the text block reaching OVERLAP px up over it.
  // Text above: mirrored.
  const textZone = Math.max(blockH + EDGE * 2 - OVERLAP, 140)
  const height = photoH + textZone
  const photoTop = textOnTop ? textZone : 0
  const blockTop = textOnTop ? EDGE : photoH - OVERLAP + EDGE

  // ---- layers ----
  const cover = await sharp(input.photo).resize(W, photoH, { fit: 'cover', position: sharp.strategy.attention }).toBuffer()
  // Under the text the page is the photo's own colours, blurred and tinted.
  const blurred = await sharp(input.photo).resize(W, height, { fit: 'cover', position: sharp.strategy.attention }).blur(60).toBuffer()

  // Clear over the photo, solid where the text sits.
  const gradTop = textOnTop ? 0 : Math.max(0, photoH - OVERLAP + EDGE - FADE)
  const gradHeight = textOnTop ? Math.min(height, blockH + EDGE * 2 + FADE) : height - gradTop
  const solidAt = Math.min(0.9, FADE / gradHeight)
  const stops = textOnTop
    ? `<stop offset="0" stop-color="${scrim}" stop-opacity="${solid}"/><stop offset="${1 - solidAt}" stop-color="${scrim}" stop-opacity="${solid - 0.05}"/><stop offset="1" stop-color="${scrim}" stop-opacity="0"/>`
    : `<stop offset="0" stop-color="${scrim}" stop-opacity="0"/><stop offset="${solidAt}" stop-color="${scrim}" stop-opacity="${solid - 0.05}"/><stop offset="1" stop-color="${scrim}" stop-opacity="${solid}"/>`
  const scrimSvg = Buffer.from(`<svg width="${W}" height="${gradHeight}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs><rect width="${W}" height="${gradHeight}" fill="url(#g)"/></svg>`)

  const layers: sharp.OverlayOptions[] = [
    { input: cover, top: photoTop, left: 0 },
    { input: scrimSvg, top: gradTop, left: 0 }
  ]

  // Hero: the cash-on-delivery pill on the photo.
  if (input.role === 'hero') {
    const pill = await textImg(BADGE[input.language], { size: 40, weight: 'bold', color: light ? '#ffffff' : p.accentDark, width: TEXT_W })
    const pw = pill.w + 90
    const ph = pill.h + 36
    const bg = Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${ph / 2}" fill="${light ? p.accent : '#ffffff'}" fill-opacity="0.96"/></svg>`)
    layers.push({ input: bg, top: 56, left: center(pw) }, { input: pill.buf, top: 56 + 18, left: center(pill.w) })
  }

  let y = blockTop
  for (const part of parts) {
    layers.push({ input: part.buf, top: Math.round(y), left: center(part.w) })
    y += part.h + part.gap
  }

  return sharp(blurred).composite(layers).webp({ quality: 90, effort: 4 }).toBuffer()
}

// Stacks finished section images into the final long page.
export async function stitchBuffers(buffers: Buffer[]): Promise<Buffer> {
  const resized = await Promise.all(buffers.map((b) => sharp(b).resize({ width: W }).toBuffer()))
  const metas = await Promise.all(resized.map((b) => sharp(b).metadata()))
  const total = metas.reduce((sum, m) => sum + (m.height ?? 0), 0)
  let offset = 0
  const composite = resized.map((input, i) => {
    const layer = { input, top: offset, left: 0 }
    offset += metas[i]!.height ?? 0
    return layer
  })
  return sharp({ create: { width: W, height: total, channels: 3, background: '#ffffff' } }).composite(composite).webp({ quality: 80, effort: 4 }).toBuffer()
}
