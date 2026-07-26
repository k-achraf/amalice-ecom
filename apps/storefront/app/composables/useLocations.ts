import type { Commune, Wilaya } from '@amalice/shared'

// Algeria wilayas — small (69 rows), stable, fetched once per page load and
// shared across every component that reads it (same useFetch key).
export function useWilayas() {
  return useApiFetch<Wilaya[]>('/wilayas', { key: 'wilayas', default: () => [] })
}

// Communes are ~1.7k rows total, so unlike wilayas they're fetched on demand
// (wilayaId required server-side) rather than loaded up front — a plain
// client fetcher, not useApiFetch, since this runs in response to a user
// picking a wilaya, not on page load.
export function useCommuneFetcher() {
  const client = useApiClient()
  return (wilayaId: string) => client<Commune[]>('/communes', { query: { wilayaId } })
}
