import type {
  CourierCommuneOption,
  LocationMapCopySuggestion,
  LocationMapSummary,
  LocationMapWilayaDetail,
  SetLocationMap
} from '@amalice/shared'

// All URLs of the courier location-mapping endpoints live here, so a route change on the API
// side is a one-file edit. `company` is what the routes address a company by (currently the
// ShippingCompany id; switch the callers to `provider` here if the API addresses it that way).
export function useLocationMapApi() {
  const api = useAdminApi()
  const base = (company: string) => `/admin/shipping-companies/${encodeURIComponent(company)}`

  return {
    summary: (company: string) => api<LocationMapSummary>(`${base(company)}/location-map`),
    wilaya: (company: string, wilayaId: string) =>
      api<LocationMapWilayaDetail>(`${base(company)}/location-map/${encodeURIComponent(wilayaId)}`),
    save: (company: string, body: SetLocationMap) =>
      api<unknown>(`${base(company)}/location-map`, { method: 'PUT', body }),
    remove: (company: string, ourWilayaId: string, ourCommune: string) =>
      api<unknown>(`${base(company)}/location-map`, { method: 'DELETE', query: { ourWilayaId, ourCommune } }),
    copyFrom: (company: string, otherCompany: string, wilayaId: string) =>
      api<LocationMapCopySuggestion[]>(`${base(company)}/location-map/copy-from/${encodeURIComponent(otherCompany)}`, { query: { wilayaId } }),
    courierCommunes: (company: string, wilayaId: string) =>
      api<CourierCommuneOption[]>(`${base(company)}/courier-communes`, { query: { wilayaId } })
  }
}
