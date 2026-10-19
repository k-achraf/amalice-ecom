// ---- Fake identity + fuzzy duplicate detection -------------------------------
// Pure helpers behind two risk signals: placeholder names/addresses ("aaaa",
// "test", "123456"...) and the same person ordering twice with a small typo in
// the name or phone. Both only ever add a warning to the order — they never
// block it.

const fold = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const PLACEHOLDER_WORDS = new Set([
  'test', 'tests', 'testing', 'essai', 'tst', 'azerty', 'qwerty', 'qsdfgh', 'asdf', 'asdfg', 'asdfgh', 'zxcv', 'wxcv',
  'xxx', 'xxxx', 'abc', 'abcd', 'abcde', 'fake', 'none', 'null', 'nom', 'name', 'prenom', 'adresse', 'address', 'nothing',
  'rien', 'aucun', 'inconnu', 'unknown', 'na', 'nn', 'ssss', 'dddd', 'hhhh', 'lorem', 'ipsum', 'blabla', 'bla', 'lol', 'mdr',
  'اختبار', 'تجربة', 'تجريبي', 'لا شيء', 'لاشيء', 'بدون', 'ااااا', 'ببببب'
])

// Consonant-less / vowel-less runs and keyboard mashing are only judged on
// Latin script; Arabic names are too short and varied for a safe heuristic.
function isMashedLatin(word: string): boolean {
  if (!/^[a-z]+$/.test(word) || word.length < 4) return false
  if (new Set(word).size <= 2) return true // "aaaa", "abab"
  if (word.length >= 5 && !/[aeiouy]/.test(word)) return true // "qsdfgh", "hjkl"
  return /(.)\1{3,}/.test(word) // "ssssd"
}

export type FakeTextKind = 'name' | 'address'

// Returns a short English reason when `text` looks like filler, or null. Meant
// to be tolerant: a real but unusual name must not be flagged, so single
// suspicious words in an otherwise normal sentence are ignored for addresses.
export function detectPlaceholderText(text: string | null | undefined, kind: FakeTextKind): string | null {
  const folded = fold(text ?? '')
  if (!folded) return null
  const words = folded.split(' ')
  const compact = words.join('')
  if (/^\d+$/.test(compact)) return 'only digits'
  if (compact.length >= 3 && new Set(compact).size === 1) return 'one repeated character'
  if (PLACEHOLDER_WORDS.has(folded)) return 'placeholder word'
  if (kind === 'name') {
    if (compact.length < 3) return 'too short'
    if (words.every((w) => PLACEHOLDER_WORDS.has(w) || isMashedLatin(w))) return 'looks like random typing'
    return null
  }
  // Address: flagged only when EVERY word is filler, or the whole text is tiny.
  if (compact.length < 4 && !/\d/.test(compact)) return 'too short'
  if (words.every((w) => PLACEHOLDER_WORDS.has(w) || isMashedLatin(w) || /^\d{1,2}$/.test(w))) return 'looks like random typing'
  return null
}

export interface FakeIdentityResult {
  name: string | null
  address: string | null
}

export function detectFakeIdentity(input: { name?: string | null; addressText?: string | null }): FakeIdentityResult {
  return {
    name: detectPlaceholderText(input.name, 'name'),
    address: detectPlaceholderText(input.addressText, 'address')
  }
}

// ---- Fuzzy matching ---------------------------------------------------------

// Damerau-Levenshtein (adjacent transposition counts as one edit), capped at
// `max` + 1 so long strings stay cheap.
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows[i] = [i]
    for (let j = 1; j <= b.length; j++) rows[i]![j] = i === 0 ? j : 0
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2]![j - 2]! + 1)
      rows[i]![j] = d
    }
  }
  return Math.min(rows[a.length]![b.length]!, max + 1)
}

// Two different phone numbers that differ by one typo (a wrong, missing, extra
// or swapped digit). Identical numbers return false: that is the exact-match
// case handled elsewhere.
export function isNearPhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (da.length < 9 || db.length < 9 || da === db) return false
  return editDistance(da, db, 1) <= 1
}

// Names written differently but meaning the same person: ignores case, accents,
// word order ("Ali Benali" / "benali ali") and up to ~1 typo per 5 letters.
export function areSimilarNames(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = (v: string | null | undefined) => fold(v ?? '').split(' ').filter(Boolean).sort().join('')
  const ka = key(a)
  const kb = key(b)
  if (ka.length < 4 || kb.length < 4) return false
  if (ka === kb) return true
  const allowed = Math.max(1, Math.floor(Math.max(ka.length, kb.length) / 5))
  return editDistance(ka, kb, allowed) <= allowed
}

export interface DuplicateCandidate {
  phone: string
  name: string | null
  region: string
  city: string
}

// `current` ordered something that `candidate` also ordered recently (the
// caller has already restricted candidates to shared products + time window).
// Same wilaya is required; then a one-typo phone, or a near-identical name in
// the same commune, makes it a probable duplicate.
export function isFuzzyDuplicate(current: DuplicateCandidate, candidate: DuplicateCandidate): boolean {
  if (fold(current.region) !== fold(candidate.region)) return false
  if (isNearPhone(current.phone, candidate.phone)) return true
  const sameCommune = fold(current.city) === fold(candidate.city)
  return sameCommune && current.phone !== candidate.phone && areSimilarNames(current.name, candidate.name)
}
