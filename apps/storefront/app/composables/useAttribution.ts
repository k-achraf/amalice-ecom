import type { AttributionChannel, AttributionTouch, OrderAttributionInput } from '@amalice/shared'

// Ad-source attribution for orders — remembers where the visitor came from
// (utm_*, campaign/ad-set/ad ids, fbclid/ttclid/gclid, landing URL, referrer)
// so the order, placed later on a different page, can be tied back to the ad.
// Mirrored by apps/funnels/src/client.js (which can't import this).
//
// The URL parameters an ad must carry for ids to be known are documented in
// packages/shared/src/attribution.ts. Stored in localStorage for 30 days:
// the FIRST touch is kept forever (within that window); the LAST touch is
// replaced only by a later visit that actually carries an ad signal, so
// clicking around the site (no params) never wipes the ad that brought them.
// Everything is best-effort — storage blocked / SSR just means no attribution.
const STORAGE_KEY = 'amalice.attribution'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

// Mirrors AttributionTouchSchema's max lengths — an over-long value must be
// trimmed here, not rejected server-side (which would fail the whole order).
const PARAMS: Record<string, { keys: string[]; max: number }> = {
  utmSource: { keys: ['utm_source'], max: 200 },
  utmMedium: { keys: ['utm_medium'], max: 200 },
  utmCampaign: { keys: ['utm_campaign'], max: 300 },
  utmContent: { keys: ['utm_content'], max: 300 },
  utmTerm: { keys: ['utm_term'], max: 300 },
  campaignId: { keys: ['campaign_id', 'utm_id'], max: 100 },
  adsetId: { keys: ['adset_id', 'adgroup_id'], max: 100 },
  adId: { keys: ['ad_id', 'creative_id'], max: 100 },
  campaignName: { keys: ['campaign_name'], max: 300 },
  adsetName: { keys: ['adset_name', 'adgroup_name'], max: 300 },
  adName: { keys: ['ad_name'], max: 300 },
  placement: { keys: ['placement'], max: 100 },
  fbclid: { keys: ['fbclid'], max: 500 },
  ttclid: { keys: ['ttclid'], max: 500 },
  gclid: { keys: ['gclid'], max: 500 }
}

interface Stored {
  first: AttributionTouch
  last: AttributionTouch
  expiresAt: number
}

function hasAdSignal(t: AttributionTouch): boolean {
  return !!(t.utmSource || t.utmMedium || t.utmCampaign || t.campaignId || t.adsetId || t.adId || t.fbclid || t.ttclid || t.gclid)
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Stored
    return parsed.expiresAt > Date.now() ? parsed : null
  } catch {
    return null
  }
}

function write(value: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked/full — attribution is best-effort.
  }
}

export function useAttribution() {
  // Called on every page load / navigation (plugins/attribution.client.ts).
  function capture() {
    if (!import.meta.client) return
    const params = new URLSearchParams(window.location.search)
    const touch: AttributionTouch = { capturedAt: Date.now() }
    for (const [field, { keys, max }] of Object.entries(PARAMS)) {
      const value = keys.map((k) => params.get(k)).find((v) => v && v.trim())
      if (value) (touch as Record<string, unknown>)[field] = value.trim().slice(0, max)
    }
    const url = new URL(window.location.href)
    url.hash = ''
    touch.landingUrl = url.toString().slice(0, 2000)
    if (document.referrer) {
      try {
        if (new URL(document.referrer).host !== window.location.host) touch.referrer = document.referrer.slice(0, 2000)
      } catch {
        // Malformed referrer — ignore.
      }
    }

    const stored = read()
    if (!stored) {
      write({ first: touch, last: touch, expiresAt: Date.now() + TTL_MS })
    } else if (hasAdSignal(touch)) {
      write({ ...stored, last: touch, expiresAt: Date.now() + TTL_MS })
    }
  }

  // The `tracking.attribution` payload for an order request.
  function getAttribution(channel: AttributionChannel): OrderAttributionInput | undefined {
    if (!import.meta.client) return undefined
    const stored = read()
    const visitorId = useVisitorId() || undefined
    const result: OrderAttributionInput = {
      ...(stored?.last ?? {}),
      channel,
      pageUrl: window.location.href.split('#')[0]!.slice(0, 2000),
      visitorId
    }
    if (stored && stored.first.capturedAt !== stored.last.capturedAt) result.firstTouch = stored.first
    return result
  }

  return { capture, getAttribution }
}
