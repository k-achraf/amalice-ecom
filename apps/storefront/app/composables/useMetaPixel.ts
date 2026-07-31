// Thin wrapper around window.fbq for the storefront's standard e-commerce
// events (AddToCart, InitiateCheckout, Purchase) — MetaPixelScript.vue owns
// loading the base pixel script and firing PageView; this is what the rest
// of the app calls to fire the events that actually matter for ad
// measurement. A no-op if the pixel isn't loaded (app disabled, no pixel ID,
// or the script hasn't finished loading yet) — every call site should be
// fire-and-forget, never a dependency for the UI to function.
//
// `eventId` matters for exactly one event: Purchase. It's the same id the
// server's Conversions API call uses (order.id, forwarded via the checkout
// request's `tracking.eventId`) — passing it here is what lets Meta dedupe
// the browser pixel's Purchase and the server's CAPI Purchase into a single
// counted event instead of two.
export function useMetaPixel() {
  function fbq(): ((...args: unknown[]) => void) | undefined {
    if (!import.meta.client) return undefined
    return (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq
  }

  function trackEvent(eventName: string, params?: Record<string, unknown>, eventId?: string) {
    const q = fbq()
    if (!q) return
    if (eventId) {
      q('track', eventName, params ?? {}, { eventID: eventId })
    } else {
      q('track', eventName, params ?? {})
    }
  }

  // Meta's own first-party cookies — _fbp is set as soon as the pixel
  // loads, _fbc only exists if the visitor arrived via a Meta ad click.
  // Forwarded to the server so the Conversions API call has better match
  // quality; both are optional and commonly absent (no consent, ad
  // blocker, organic visit), which is fine — CAPI works without them.
  function getFbCookies(): { fbp?: string; fbc?: string } {
    if (!import.meta.client) return {}
    const read = (name: string) => {
      const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
      return match?.[1] ? decodeURIComponent(match[1]) : undefined
    }
    return { fbp: read('_fbp'), fbc: read('_fbc') }
  }

  function generateEventId(): string {
    return import.meta.client && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  return { trackEvent, getFbCookies, generateEventId }
}
