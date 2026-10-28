import { defaultCourierWilayaId, type CourierCommuneOption, type LocationMapStatus } from '@amalice/shared'
import { matchCommune, normalizePlaceName, rankCommunes, type CourierCommune } from './address-matching'

// Pure helpers for the per-company location mapping (no I/O, unit-tested).

export const MAX_SUGGESTIONS = 5

const toOption = (c: CourierCommune): CourierCommuneOption => ({ name: c.name, postalCode: c.postalCode, hasStopDesk: c.hasStopDesk })

export interface CommuneClassification {
  status: Exclude<LocationMapStatus, 'mapped'>
  matchedCommune: CourierCommuneOption | null
  suggestions: CourierCommuneOption[]
}

// matched = exact normalized name equality; review = near match (matchCommune) or a close
// suggestion; unmapped = nothing close (or the courier has no communes there).
export function classifyCommune(ourCommune: string, courierCommunes: CourierCommune[]): CommuneClassification {
  const wanted = normalizePlaceName(ourCommune)
  if (!wanted || !courierCommunes.length) return { status: 'unmapped', matchedCommune: null, suggestions: [] }
  const exact = courierCommunes.find((c) => normalizePlaceName(c.name) === wanted)
  if (exact) return { status: 'matched', matchedCommune: toOption(exact), suggestions: [] }

  const ranked = rankCommunes(courierCommunes, ourCommune)
  const suggestions = ranked.slice(0, MAX_SUGGESTIONS).map((r) => toOption(r.commune))
  const { match } = matchCommune(courierCommunes, ourCommune)
  if (match) {
    // The auto-accepted near match goes first.
    const rest = suggestions.filter((s) => s.name !== match.name)
    return { status: 'review', matchedCommune: null, suggestions: [toOption(match), ...rest].slice(0, MAX_SUGGESTIONS) }
  }
  const best = ranked[0]
  const close = !!best && best.score <= Math.max(2, Math.floor(wanted.length / 3))
  return { status: close ? 'review' : 'unmapped', matchedCommune: null, suggestions }
}

export interface MapRowLike {
  ourWilayaId: string
  ourCommune: string
  courierWilayaId: string
  courierCommune: string | null
  courierPostalCode: string | null
}

// The courier wilaya our communes are looked up in: commune row, else saved wilaya row, else default.
export function resolveCourierWilaya(ourWilayaId: string, wilayaRow: MapRowLike | null | undefined, communeRow?: MapRowLike | null): { id: string; source: 'mapped' | 'default' } {
  if (communeRow?.courierWilayaId) return { id: communeRow.courierWilayaId, source: 'mapped' }
  if (wilayaRow?.courierWilayaId) return { id: wilayaRow.courierWilayaId, source: 'mapped' }
  return { id: defaultCourierWilayaId(ourWilayaId), source: 'default' }
}

export type ProposalSource = 'order' | 'map' | 'auto' | 'default' | 'none'
export interface Proposal {
  courierWilayaId: string
  courierCommune: string | null
  courierPostalCode: string | null
  source: ProposalSource
}

// What the "Convert location" dialog pre-fills. Order of preference: the order's own saved
// value, the company's saved commune mapping, an automatic exact/near match inside the
// courier wilaya, the bare wilaya, nothing.
export function buildProposal(args: {
  ourWilayaId: string | null
  ourCommune: string
  current: { courierWilayaId: string; courierCommune: string; courierPostalCode: string | null } | null
  communeRow: MapRowLike | null
  wilayaRow: MapRowLike | null
  // Communes of the courier wilaya that will be resolved (wilayaId -> communes).
  communesOf: (courierWilayaId: string) => CourierCommune[]
}): Proposal {
  if (args.current) return { ...args.current, source: 'order' }
  if (!args.ourWilayaId) return { courierWilayaId: '', courierCommune: null, courierPostalCode: null, source: 'none' }
  const wilaya = resolveCourierWilaya(args.ourWilayaId, args.wilayaRow, args.communeRow)
  if (args.communeRow?.courierCommune) {
    const found = args.communesOf(wilaya.id).find((c) => c.name === args.communeRow!.courierCommune)
    return { courierWilayaId: wilaya.id, courierCommune: args.communeRow.courierCommune, courierPostalCode: args.communeRow.courierPostalCode ?? found?.postalCode ?? null, source: 'map' }
  }
  const { match } = matchCommune(args.communesOf(wilaya.id), args.ourCommune)
  if (match) return { courierWilayaId: wilaya.id, courierCommune: match.name, courierPostalCode: match.postalCode, source: 'auto' }
  return { courierWilayaId: wilaya.id, courierCommune: null, courierPostalCode: null, source: 'default' }
}
