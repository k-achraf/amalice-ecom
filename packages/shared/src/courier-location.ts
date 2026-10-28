import { z } from 'zod'

// Our 69 wilayas vs a courier's (possibly older, 58-wilaya) list, and communes spelled
// differently per courier. Mapping is PER SHIPPING COMPANY and always applied by hand:
// the "Location mapping" settings page stores it, the "Convert location" button on an
// order at shipping time pre-fills from it and an agent confirms.

// Our wilayas 59-69 (created in 2025) sit inside these parent wilayas at couriers that still
// run the old 58-wilaya list. Used only as a SUGGESTION when a company has no mapping yet.
export const DEFAULT_COURIER_PARENT_WILAYA: Record<string, string> = {
  // Wilayas created in 2019 that a courier may not list either (Ecotrack's active list has 51, 54,
  // 55, 57, 58 but not 49, 50, 52, 53, 56): their communes are under the old parent wilaya.
  '49': '1', // Timimoun -> Adrar
  '50': '1', // Bordj Badji Mokhtar -> Adrar
  '52': '8', // Beni Abbes -> Bechar
  '53': '11', // In Salah -> Tamanrasset
  '56': '33', // Djanet -> Illizi
  '59': '3', // Aflou -> Laghouat
  '60': '5', // Barika -> Batna
  '61': '7', // El Kantara -> Biskra
  '62': '12', // Bir El Ater -> Tebessa
  '63': '13', // El Aricha -> Tlemcen
  '64': '14', // Ksar Chellala -> Tiaret
  '65': '17', // Ain Oussera -> Djelfa
  '66': '17', // Messad -> Djelfa
  '67': '26', // Ksar El Boukhari -> Medea
  '68': '28', // Bou Saada -> M'Sila
  '69': '32' // El Abiodh Sidi Cheikh -> El Bayadh
}

// What the courier's wilaya would be if nothing is mapped (59-69 -> parent, else the same id).
export function defaultCourierWilayaId(ourWilayaId: string): string {
  return DEFAULT_COURIER_PARENT_WILAYA[ourWilayaId] ?? ourWilayaId
}

// ---- Mapping page (settings) ----

// matched  = the courier has a commune with our exact name (nothing to do)
// review   = a close name exists (El karma / El kerma): confirm the suggestion
// unmapped = nothing close: pick from the courier's list
// mapped   = an agent saved a mapping
export const LOCATION_MAP_STATUSES = ['matched', 'review', 'unmapped', 'mapped'] as const
export type LocationMapStatus = (typeof LOCATION_MAP_STATUSES)[number]

export interface CourierCommuneOption {
  name: string
  postalCode: string | null
  hasStopDesk: boolean
}

export interface LocationMapCommuneRow {
  commune: string // our commune name, as orders store it
  status: LocationMapStatus
  // The saved mapping, when status = 'mapped'.
  mapped: { courierWilayaId: string; courierCommune: string | null; courierPostalCode: string | null } | null
  // The courier's own commune when status = 'matched'.
  matchedCommune: CourierCommuneOption | null
  // Closest courier communes (best first) for status = 'review' | 'unmapped'.
  suggestions: CourierCommuneOption[]
}

// GET admin/shipping-companies/:id/location-map            -> LocationMapSummary
export interface LocationMapWilayaSummary {
  wilayaId: string
  wilayaName: string
  // The courier wilaya our communes are looked up in: the saved wilaya mapping, else the default.
  courierWilayaId: string
  courierWilayaSource: 'mapped' | 'default'
  communeCount: number
  matched: number
  review: number
  unmapped: number
  mapped: number
}
export interface LocationMapSummary {
  company: { id: string; name: string; locationsSyncedAt: string | null }
  wilayas: LocationMapWilayaSummary[]
  // Courier wilaya ids that have communes in the synced list (to pick a wilaya mapping from).
  courierWilayaIds: string[]
}

// GET admin/shipping-companies/:id/location-map/:wilayaId  -> LocationMapWilayaDetail
export interface LocationMapWilayaDetail {
  wilayaId: string
  wilayaName: string
  courierWilayaId: string
  courierWilayaSource: 'mapped' | 'default'
  communes: LocationMapCommuneRow[]
  // Every commune of the courier wilaya, to choose from manually.
  courierCommunes: CourierCommuneOption[]
}

// PUT admin/shipping-companies/:id/location-map
// ourCommune omitted/'' = a wilaya-level mapping (courierWilayaId only).
export const SetLocationMapSchema = z.object({
  ourWilayaId: z.string().min(1),
  ourCommune: z.string().trim().default(''),
  courierWilayaId: z.string().min(1),
  courierCommune: z.string().trim().min(1).nullable().optional(),
  courierPostalCode: z.string().trim().nullable().optional()
})
export type SetLocationMap = z.infer<typeof SetLocationMapSchema>

// DELETE admin/shipping-companies/:id/location-map?ourWilayaId=&ourCommune=

// GET admin/shipping-companies/:id/location-map/copy-from/:otherCompanyId?wilayaId=
// Rows another company already mapped, offered as SUGGESTIONS only (never saved by this call).
export interface LocationMapCopySuggestion {
  ourWilayaId: string
  ourCommune: string
  courierWilayaId: string
  courierCommune: string | null
  courierPostalCode: string | null
  // True when this company's courier list really has that commune (so the suggestion is usable).
  existsAtThisCompany: boolean
}

// GET admin/shipping-companies/:id/courier-communes?wilayaId=  -> CourierCommuneOption[]

// ---- Convert location on an order (shipping stage) ----

// GET admin/fulfillment/orders/:id/courier-location
export interface OrderCourierLocation {
  // `provider` addresses the company in admin/shipping-companies/:provider/... routes.
  company: { id: string; name: string; provider: string } | null
  ourWilaya: { id: string | null; name: string }
  ourCommune: string
  // What is saved on the order for the CURRENT company, or null.
  current: { courierWilayaId: string; courierCommune: string; courierPostalCode: string | null } | null
  // What the dialog should pre-fill: the order's own value, else the company's saved mapping,
  // else an automatic near-match, else nothing. Always confirmed by the agent.
  proposal: { courierWilayaId: string; courierCommune: string | null; courierPostalCode: string | null; source: 'order' | 'map' | 'auto' | 'default' | 'none' }
  courierWilayaIds: string[]
}

// POST admin/fulfillment/orders/:id/courier-location (DELETE clears it)
export const SetOrderCourierLocationSchema = z.object({
  courierWilayaId: z.string().min(1),
  courierCommune: z.string().trim().min(1),
  courierPostalCode: z.string().trim().nullable().optional()
})
export type SetOrderCourierLocation = z.infer<typeof SetOrderCourierLocationSchema>
