// Thin wrapper around window.ttq for the storefront's standard e-commerce
// events (AddToCart, InitiateCheckout, CompletePayment) — mirrors
// useMetaPixel.ts exactly, adapted to TikTok's SDK shape (ttq.track(name,
// params) instead of fbq('track', name, params), and TikTok's dedup
// mechanism, which passes the id inside the params object as `event_id`
// rather than as a separate trailing argument like Meta's `{eventID}`).
//
// A no-op if the pixel isn't loaded — every call site should be
// fire-and-forget, never a dependency for the UI to function.
export function useTikTokPixel() {
  function ttq(): { track?: (...args: unknown[]) => void } | undefined {
    if (!import.meta.client) return undefined
    return (window as unknown as { ttq?: { track?: (...args: unknown[]) => void } }).ttq
  }

  function trackEvent(eventName: string, params?: Record<string, unknown>, eventId?: string) {
    const q = ttq()
    if (!q?.track) return
    q.track(eventName, eventId ? { ...params, event_id: eventId } : (params ?? {}))
  }

  // TikTok's own first-party cookie — _ttp is set as soon as the pixel
  // loads. Forwarded to the server so the Events API call has better match
  // quality; commonly absent (no consent, ad blocker, organic visit),
  // which is fine — the Events API works without it.
  function getTtCookie(): { ttp?: string } {
    if (!import.meta.client) return {}
    const match = document.cookie.match(/(?:^|; )_ttp=([^;]*)/)
    return { ttp: match?.[1] ? decodeURIComponent(match[1]) : undefined }
  }

  return { trackEvent, getTtCookie }
}
