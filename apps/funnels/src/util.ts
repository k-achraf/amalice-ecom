import { createHash } from 'node:crypto'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export const esc = (s: string | number | null | undefined): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!)

// JSON that is safe inside an inline <script>: "<" can never open a tag or close the script.
export const escJson = (v: unknown): string =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029')

// Widths the image proxy will produce. Few sizes = few cached files and a high cache-hit rate.
export const IMG_WIDTHS = [320, 480, 640, 800, 1080, 1440] as const

// Every photo goes through our resizing proxy. Uploads are addressed by path; external image links are
// addressed by a hash that only maps back to a URL we ourselves rendered into a page, so the proxy can
// never be pointed at an arbitrary address (no open proxy / SSRF).
const external = new Map<string, string>()
const MAX_EXTERNAL = 5000

export function externalImage(hash: string): string | undefined {
  return external.get(hash)
}

export function imgUrl(url: string, width: number): string {
  if (url.startsWith('/uploads/')) return `/img?u=${encodeURIComponent(url)}&w=${width}`
  if (/^https?:\/\//i.test(url)) {
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 24)
    if (external.size >= MAX_EXTERNAL) external.delete(external.keys().next().value!)
    external.set(hash, url)
    return `/img?e=${hash}&w=${width}`
  }
  return url
}

export function imgSrcset(url: string, widths: readonly number[] = [480, 800, 1080]): string {
  if (!url.startsWith('/uploads/') && !/^https?:\/\//i.test(url)) return ''
  return widths.map((w) => `${imgUrl(url, w)} ${w}w`).join(', ')
}

// Product descriptions come from the admin's rich-text editor (HTML). Only a small set of formatting tags
// survives; every attribute is dropped except safe links. Everything else is escaped text.
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a'])
const VOID = new Set(['br'])
const safeHref = (raw: string): string | null => {
  const href = raw.trim()
  return /^(https?:\/\/|tel:|mailto:|\/)/i.test(href) ? href : null
}

export function sanitizeHtml(html: string): string {
  let out = ''
  let last = 0
  const open: string[] = []
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    out += esc(decode(html.slice(last, m.index)))
    last = m.index + m[0].length
    const closing = m[1] === '/'
    const name = m[2]!.toLowerCase()
    if (!ALLOWED.has(name)) continue
    if (closing) {
      const i = open.lastIndexOf(name)
      if (i === -1) continue
      while (open.length > i) out += `</${open.pop()}>`
    } else if (VOID.has(name)) {
      out += `<${name}>`
    } else if (name === 'a') {
      const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3] ?? '')
      const safe = href ? safeHref(decode(href[1] ?? href[2] ?? '')) : null
      out += safe ? `<a href="${esc(safe)}" rel="noopener nofollow" target="_blank">` : '<a>'
      open.push('a')
    } else {
      out += `<${name}>`
      open.push(name)
    }
  }
  out += esc(decode(html.slice(last)))
  while (open.length) out += `</${open.pop()}>`
  return out
}

// Text between tags arrives entity-encoded; decode once so esc() re-encodes it exactly once.
function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function plainText(html: string | null, max = 160): string {
  if (!html) return ''
  const t = decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
