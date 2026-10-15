import { join } from 'node:path'
import sharp from 'sharp'
import type { LandingLanguage, LandingStyle } from '@amalice/shared'
import { CTA_BUTTON } from './landing-copy.util'

// Composes one landing-page section in code: a background (the AI scene, or a
// designed gradient), the product's REAL photo untouched on a card, and the copy
// drawn as real text with the bundled Cairo font (Arabic shaping + right-to-left
// handled by Pango/HarfBuzz). Because the AI never draws letters or the product,
// text can't be misspelled or garbled and the product can't be distorted — and a
// copy edit re-renders in under a second with no AI call.

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

// Words describing the palette for the scene prompt.
export function paletteHint(p: Palette, style: LandingStyle): string {
  return `dominant colour ${p.accent}, deep shade ${p.accentDark}, ${style === 'light' ? `light tones near ${p.accentLight}` : 'rich dark tones'}`
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

// ---- photo card ----

async function photoCard(photo: Buffer, maxW: number, maxH: number, o: { pad: number; radius: number; bg: string }): Promise<Img> {
  const fitted = await sharp(photo).rotate().flatten({ background: '#ffffff' }).resize({ width: maxW - o.pad * 2, height: maxH - o.pad * 2, fit: 'inside', withoutEnlargement: false }).toBuffer()
  const fm = await sharp(fitted).metadata()
  const w = (fm.width ?? 0) + o.pad * 2
  const h = (fm.height ?? 0) + o.pad * 2
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${o.radius}" fill="#fff"/></svg>`)
  // Two passes: sharp only applies the LAST composite() call in a pipeline.
  const withPhoto = await sharp({ create: { width: w, height: h, channels: 4, background: o.bg } })
    .composite([{ input: fitted, top: o.pad, left: o.pad }])
    .png()
    .toBuffer()
  const card = await sharp(withPhoto).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  return { buf: card, w, h }
}

async function shadow(w: number, h: number, radius: number): Promise<Buffer> {
  const blur = 28
  const svg = Buffer.from(`<svg width="${w + blur * 4}" height="${h + blur * 4}"><rect x="${blur * 2}" y="${blur * 2}" width="${w}" height="${h}" rx="${radius}" fill="#000" fill-opacity="0.42"/></svg>`)
  return sharp(svg).blur(blur).png().toBuffer()
}

// ---- background ----

async function background(h: number, o: { scene: Buffer | null; palette: Palette; style: LandingStyle; role: 'hero' | 'feature' | 'cta'; index: number }): Promise<Buffer> {
  const p = o.palette
  const light = o.style === 'light'
  // Gradient endpoints per style; the CTA is always the most saturated section.
  const top = light ? p.paper : o.style === 'dark' ? '#0b0f12' : p.accentDark
  const bottom = light ? p.accentLight : o.style === 'dark' ? p.accentDark : o.role === 'cta' ? p.accent : p.accentDark
  const dir = o.index % 2 === 0 ? 'x1="0" y1="0" x2="0.25" y2="1"' : 'x1="0" y1="1" x2="0.25" y2="0"'
  const circles = `<circle cx="${o.index % 2 ? 140 : W - 140}" cy="${Math.round(h * 0.22)}" r="320" fill="${light ? p.accent : '#fff'}" fill-opacity="${light ? 0.06 : 0.05}"/>
    <circle cx="${o.index % 2 ? W - 90 : 90}" cy="${Math.round(h * 0.82)}" r="260" fill="${light ? p.accent : '#fff'}" fill-opacity="${light ? 0.05 : 0.04}"/>`
  const gradient = Buffer.from(`<svg width="${W}" height="${h}"><defs><linearGradient id="g" ${dir}><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${W}" height="${h}" fill="url(#g)"/>${circles}</svg>`)
  if (!o.scene) return sharp(gradient).png().toBuffer()

  // AI scene behind a tint, so the text stays readable whatever the scene is.
  const tint = light ? '#ffffff' : p.accentDark
  const overlay = Buffer.from(`<svg width="${W}" height="${h}"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint}" stop-opacity="${light ? 0.78 : 0.7}"/><stop offset="1" stop-color="${tint}" stop-opacity="${light ? 0.6 : 0.5}"/></linearGradient></defs><rect width="${W}" height="${h}" fill="url(#t)"/></svg>`)
  const scene = await sharp(o.scene).resize(W, h, { fit: 'cover', position: 'centre' }).toBuffer()
  return sharp(scene).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer()
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
  scene: Buffer | null
  photos: Buffer[]
}

const BADGE: Record<LandingLanguage, string> = { ar: 'الدفع عند الاستلام', fr: 'Paiement à la livraison', en: 'Pay on delivery' }

export async function renderSection(input: RenderInput): Promise<Buffer> {
  const p = input.palette
  const light = input.style === 'light'
  const textColor = light ? p.ink : '#ffffff'
  const softColor = light ? '#3d4a49' : '#e8eeee'
  const photo = input.photos.length ? input.photos[input.index % input.photos.length]! : null

  const layers: { buf: Buffer; top: number; left: number }[] = []
  const center = (w: number) => Math.round((W - w) / 2)
  let y = 0

  const place = (img: Img, top: number) => layers.push({ buf: img.buf, top, left: center(img.w) })
  const placeCard = async (card: Img, top: number) => {
    const sh = await shadow(card.w, card.h, 40)
    layers.push({ buf: sh, top: top - 56 + 18, left: center(card.w) - 56 })
    layers.push({ buf: card.buf, top, left: center(card.w) })
  }

  if (input.role === 'hero') {
    y = 130
    const headline = await textImg(input.headline, { size: 88, weight: 'bold', color: textColor, width: TEXT_W, spacing: -18 })
    place(headline, y)
    y += headline.h + 28
    const body = await textImg(input.body, { size: 46, weight: 'regular', color: softColor, width: TEXT_W - 60, spacing: -8 })
    place(body, y)
    y += body.h + 70
    if (photo) {
      const card = await photoCard(photo, 900, 980, { pad: 26, radius: 40, bg: '#ffffff' })
      await placeCard(card, y)
      y += card.h + 70
    }
    const pill = await textImg(BADGE[input.language], { size: 40, weight: 'bold', color: light ? '#ffffff' : p.accentDark, width: TEXT_W })
    const pw = pill.w + 90
    const ph = pill.h + 36
    const pillBg = Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="${ph / 2}" fill="${light ? p.accent : '#ffffff'}"/></svg>`)
    layers.push({ buf: pillBg, top: y, left: center(pw) })
    layers.push({ buf: pill.buf, top: y + 18, left: center(pill.w) })
    y += ph + 110
  } else if (input.role === 'feature') {
    const textFirst = input.index % 2 === 1
    y = 110
    const blocks = async () => {
      const badgeSize = 96
      const num = await textImg(String(input.featureNumber), { size: 52, weight: 'bold', color: light ? '#ffffff' : p.accentDark, width: badgeSize })
      const circle = Buffer.from(`<svg width="${badgeSize}" height="${badgeSize}"><circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2}" fill="${light ? p.accent : '#ffffff'}"/></svg>`)
      layers.push({ buf: circle, top: y, left: center(badgeSize) })
      layers.push({ buf: num.buf, top: y + Math.round((badgeSize - num.h) / 2) - 2, left: center(num.w) })
      y += badgeSize + 40
      const headline = await textImg(input.headline, { size: 74, weight: 'bold', color: textColor, width: TEXT_W, spacing: -16 })
      place(headline, y)
      y += headline.h + 26
      const body = await textImg(input.body, { size: 44, weight: 'regular', color: softColor, width: TEXT_W - 40, spacing: -8 })
      place(body, y)
      y += body.h + 70
    }
    if (textFirst) {
      await blocks()
      if (photo) {
        const card = await photoCard(photo, 860, 860, { pad: 24, radius: 44, bg: '#ffffff' })
        await placeCard(card, y)
        y += card.h + 110
      }
    } else {
      if (photo) {
        const card = await photoCard(photo, 860, 860, { pad: 24, radius: 44, bg: '#ffffff' })
        await placeCard(card, y)
        y += card.h + 80
      }
      await blocks()
      y += 40
    }
  } else {
    y = 130
    const headline = await textImg(input.headline, { size: 84, weight: 'bold', color: textColor, width: TEXT_W, spacing: -18 })
    place(headline, y)
    y += headline.h + 28
    const body = await textImg(input.body, { size: 46, weight: 'regular', color: softColor, width: TEXT_W - 60, spacing: -8 })
    place(body, y)
    y += body.h + 80
    if (photo) {
      const card = await photoCard(photo, 640, 640, { pad: 22, radius: 40, bg: '#ffffff' })
      await placeCard(card, y)
      y += card.h + 90
    }
    // The order button — the page's single call to action.
    const label = await textImg(CTA_BUTTON[input.language], { size: 52, weight: 'bold', color: light || input.style === 'dark' ? '#ffffff' : p.accentDark, width: TEXT_W - 80 })
    const bw = Math.min(W - PAD * 2, Math.max(label.w + 120, 700))
    const bh = label.h + 64
    const buttonColor = light || input.style === 'dark' ? p.accent : '#ffffff'
    const button = Buffer.from(`<svg width="${bw}" height="${bh}"><rect width="${bw}" height="${bh}" rx="${bh / 2}" fill="${buttonColor}"/></svg>`)
    layers.push({ buf: button, top: y, left: center(bw) })
    layers.push({ buf: label.buf, top: y + 32, left: center(label.w) })
    y += bh + 130
  }

  const height = Math.round(y)
  const base = await background(height, { scene: input.scene, palette: p, style: input.style, role: input.role, index: input.index })
  return sharp(base).composite(layers.map((l) => ({ input: l.buf, top: Math.round(l.top), left: Math.round(l.left) }))).webp({ quality: 90, effort: 4 }).toBuffer()
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
