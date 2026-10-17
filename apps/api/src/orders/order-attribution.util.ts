import type { AttributionPlatform, OrderAttributionInput } from '@amalice/shared'
import type { Request } from 'express'

// Best-effort real client IP. Behind nginx/Cloudflare Express's req.ip is the
// proxy's address, so prefer the proxy headers. Spoofable by a direct caller,
// which is fine here: the value is only an attribution / ad-match hint, never
// an access-control decision (the rate limiter still keys off req.ip).
export function clientIp(req: Request): string | undefined {
  const header = (name: string) => {
    const v = req.headers[name]
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
  }
  const forwarded = header('x-forwarded-for')?.split(',')[0]?.trim()
  return header('cf-connecting-ip') ?? header('x-real-ip') ?? forwarded ?? req.ip
}

const SEARCH_HOSTS = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia)\./i
const SOCIAL_HOSTS = /(^|\.)(facebook|fb|instagram|l\.instagram|messenger|tiktok|snapchat|youtube|twitter|x|t|whatsapp|pinterest|linkedin)\.(com|me|co|net)$/i

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function platformFromName(name: string | undefined): AttributionPlatform | null {
  const n = name?.trim().toLowerCase()
  if (!n) return null
  if (/^(facebook|fb|ig|instagram|meta|messenger|an|audience[-_ ]?network)/.test(n)) return 'Meta'
  if (/^tiktok|^tt$/.test(n)) return 'TikTok'
  if (/^(google|gads|adwords|youtube|yt)/.test(n)) return 'Google'
  if (/^snap/.test(n)) return 'Snapchat'
  return 'Other'
}

// Click ids are the strongest signal (only an ad click on that platform
// appends them), then utm_source, then the referrer host. A referrer from a
// social/search site without any ad signal is "Organic"; no signal at all is
// "Direct".
export function resolvePlatform(a: OrderAttributionInput | undefined): AttributionPlatform {
  if (!a) return 'Direct'
  if (a.fbclid) return 'Meta'
  if (a.ttclid) return 'TikTok'
  if (a.gclid) return 'Google'
  const fromSource = platformFromName(a.utmSource)
  if (fromSource) return fromSource
  if (a.campaignId || a.adId || a.adsetId || a.utmCampaign || a.utmMedium) return 'Other'
  const host = hostOf(a.referrer)
  if (host && (SEARCH_HOSTS.test(host) || SOCIAL_HOSTS.test(host))) return 'Organic'
  return 'Direct'
}

export function deviceTypeOf(userAgent: string | undefined): string | null {
  if (!userAgent) return null
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return 'tablet'
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

// Meta only counts an ad click toward match quality when fbc is present; when
// the _fbc cookie isn't set (pixel blocked / not yet loaded) it can be rebuilt
// from the fbclid in the landing URL, in Meta's documented fb.1.<ms>.<fbclid>
// format.
export function fbcFromFbclid(fbclid: string | undefined, capturedAt?: number): string | undefined {
  return fbclid ? `fb.1.${capturedAt ?? Date.now()}.${fbclid}` : undefined
}
