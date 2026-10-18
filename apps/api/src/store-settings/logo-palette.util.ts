import sharp from 'sharp'

export interface LogoPalette {
  /** Dominant colours as #rrggbb, most prominent first. */
  palette: string[]
  /** Best candidate for the brand colour (vivid, not near white/black), or null. */
  primary: string | null
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

function hsl(r: number, g: number, b: number): { s: number; l: number } {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s, l }
}

// Reads the logo's pixels (SVG is rasterised by sharp) and clusters them into
// colour buckets: transparent and near-white pixels (backgrounds) are ignored,
// saturated colours are weighted up so a small vivid mark beats a large grey
// wordmark, and clusters closer than a perceptual threshold are merged.
export async function extractLogoPalette(buffer: Buffer, maxColors = 6): Promise<LogoPalette> {
  const { data, info } = await sharp(buffer, { density: 200 })
    .resize(128, 128, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4
    const r = data[o]!
    const g = data[o + 1]!
    const b = data[o + 2]!
    const a = data[o + 3]!
    if (a < 200) continue
    if (r > 238 && g > 238 && b > 238) continue
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    cur.n++
    cur.r += r
    cur.g += g
    cur.b += b
    buckets.set(key, cur)
  }

  const scored = [...buckets.values()]
    .map((c) => {
      const r = c.r / c.n
      const g = c.g / c.n
      const b = c.b / c.n
      return { r, g, b, score: c.n * (0.3 + hsl(r, g, b).s) }
    })
    .sort((a, b) => b.score - a.score)

  const chosen: typeof scored = []
  for (const c of scored) {
    if (chosen.length >= maxColors) break
    const near = chosen.some((k) => Math.hypot(k.r - c.r, k.g - c.g, k.b - c.b) < 64)
    if (!near) chosen.push(c)
  }

  const vivid = chosen.find((c) => {
    const { s, l } = hsl(c.r, c.g, c.b)
    return s >= 0.25 && l >= 0.12 && l <= 0.85
  })
  const pick = vivid ?? chosen[0]
  return {
    palette: chosen.map((c) => toHex(c.r, c.g, c.b)),
    primary: pick ? toHex(pick.r, pick.g, pick.b) : null
  }
}
