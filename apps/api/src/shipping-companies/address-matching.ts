// Matching our free-form commune names against the spelling a courier accepts.
// Couriers reject a commune that is not written exactly as in their own list
// ("Commune mal écrite, ou désactivée"), so addresses are checked up front.

export function normalizePlaceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(commune|daira|wilaya)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]!
}

export interface CourierCommune {
  name: string
  postalCode: string | null
  hasStopDesk: boolean
}

export function matchCommune(communes: CourierCommune[], city: string): { match: CourierCommune | null; suggestions: string[] } {
  const wanted = normalizePlaceName(city)
  if (!wanted) return { match: null, suggestions: [] }
  const exact = communes.find((c) => normalizePlaceName(c.name) === wanted)
  if (exact) return { match: exact, suggestions: [] }

  const scored = communes
    .map((c) => {
      const n = normalizePlaceName(c.name)
      const contains = n.includes(wanted) || wanted.includes(n)
      return { c, score: contains ? 0 : levenshtein(n, wanted), n }
    })
    .sort((a, b) => a.score - b.score)
  const best = scored[0]
  // One clearly-closest candidate (a 1-letter typo, or a containment) is accepted
  // automatically; anything vaguer is only offered as a suggestion.
  const threshold = Math.max(1, Math.floor(wanted.length / 8))
  if (best && best.score <= threshold && (!scored[1] || scored[1].score > best.score)) {
    return { match: best.c, suggestions: [] }
  }
  return { match: null, suggestions: scored.slice(0, 5).map((x) => x.c.name) }
}
