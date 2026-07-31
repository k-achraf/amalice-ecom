import sharp from 'sharp'

// Draws headline/body text onto an image, code-side — used only for
// providers that can't reliably render on-image text themselves (Pollinations;
// see pollinations.service.ts). Gemini draws its own text and never calls this.

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// SVG <text> doesn't auto-wrap, so lines are broken manually using a rough
// average-character-width estimate — good enough for short marketing copy,
// not meant to be typographically exact.
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function overlayTextOnImage(
  imageBuffer: Buffer,
  input: { role: 'hero' | 'feature' | 'cta'; headline: string; body: string }
): Promise<Buffer> {
  const image = sharp(imageBuffer)
  const meta = await image.metadata()
  const width = meta.width ?? 1024
  const height = meta.height ?? 1536

  const headlineSize = Math.round(width * 0.075)
  const bodySize = Math.round(width * 0.038)
  const headlineLines = wrapText(input.headline, Math.max(6, Math.floor(width / (headlineSize * 0.55))))
  const bodyLines = wrapText(input.body, Math.max(10, Math.floor(width / (bodySize * 0.55))))

  const accent = input.role === 'cta' ? '#e11d48' : '#0f172a'
  const textBlockHeight = headlineLines.length * headlineSize * 1.25 + bodyLines.length * bodySize * 1.4 + 60
  const scrimHeight = Math.min(height, Math.max(Math.round(height * 0.36), textBlockHeight))
  const scrimTop = height - scrimHeight

  let y = scrimTop + Math.round((scrimHeight - textBlockHeight) / 2) + headlineSize
  let textEls = ''
  for (const line of headlineLines) {
    textEls += `<text x="${width / 2}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${headlineSize}" fill="#ffffff" text-anchor="middle">${escapeXml(line)}</text>`
    y += headlineSize * 1.25
  }
  y += 20
  for (const line of bodyLines) {
    textEls += `<text x="${width / 2}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="400" font-size="${bodySize}" fill="#e5e7eb" text-anchor="middle">${escapeXml(line)}</text>`
    y += bodySize * 1.4
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0" />
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.9" />
      </linearGradient>
    </defs>
    <rect x="0" y="${scrimTop}" width="${width}" height="${scrimHeight}" fill="url(#scrim)" />
    ${textEls}
  </svg>`

  return image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer()
}
