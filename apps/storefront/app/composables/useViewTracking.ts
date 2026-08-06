import type { PageViewType } from '@amalice/shared'

// First-party view-tracking — feeds the admin dashboard's "storefront
// traffic" section (packages/shared/src/analytics.ts). Deliberately
// separate from useMetaPixel/useTikTokPixel: those exist for ad-platform
// attribution and depend on the store having a pixel configured at all;
// this exists so the admin can see real traffic numbers regardless, since
// we can't query Meta/TikTok's own dashboards for that. Fire-and-forget by
// design — a tracking call must never block or break the page it's called
// from.
export function useViewTracking() {
  function recordView(type: PageViewType, entityId?: string) {
    if (!import.meta.client) return
    const visitorId = useVisitorId()
    if (!visitorId) return
    const config = useRuntimeConfig()
    $fetch('/analytics/view', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { type, entityId, path: window.location.pathname, visitorId }
    }).catch(() => {
      // Best-effort — a dropped view-tracking call is never worth surfacing
      // to the visitor or retrying.
    })
  }

  return { recordView }
}
