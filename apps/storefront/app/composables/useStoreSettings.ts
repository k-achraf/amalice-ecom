import type { StoreSettings, StoreTemplate } from '@amalice/shared'

// The single source of truth for the active storefront template + chrome copy.
//
// useAsyncData with a stable key re-runs the handler on every SSR request (so
// an admin template switch is reflected on the next visitor load) and dedupes
// concurrent calls within a single render pass (many components read this).
// The public /settings endpoint is exempt from the API throttler
// (@SkipThrottle on the controller) so per-request fetching never 429s.
const FALLBACK: StoreSettings = {
  activeTemplate: 'minimal',
  storeName: 'Amalice',
  announcementText: null,
  displayCart: true,
  abandonedCartDelaySeconds: 60
}

export function useStoreSettings() {
  const config = useRuntimeConfig()
  const { data } = useAsyncData<StoreSettings>(
    'store-settings',
    () => $fetch<StoreSettings>('/settings', { baseURL: config.public.apiBase }),
    { default: () => ({ ...FALLBACK }) }
  )
  return computed<StoreSettings>(() => data.value ?? FALLBACK)
}

export function useActiveTemplate() {
  return computed<StoreTemplate>(() => useStoreSettings().value.activeTemplate)
}
