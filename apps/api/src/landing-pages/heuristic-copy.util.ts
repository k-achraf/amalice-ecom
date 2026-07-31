import type { DraftedSection } from './gemini.service'

// Zero-AI fallback for drafting section copy — used on the Pollinations
// image path so it has no Gemini dependency at all (Gemini's text model,
// while normally free, requires a funded prepay balance once a Google Cloud
// project has billing linked, same as its image models). Splits the raw
// description into sentences instead of having an LLM rewrite it — reads
// more mechanical than AI-drafted copy, but costs nothing and needs no key.

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}…`
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase())
}

// Trims trailing articles/prepositions so a hard word-count cut doesn't
// leave a headline dangling mid-phrase (e.g. "...Tote For").
const TRAILING_STOPWORDS = new Set(['a', 'an', 'the', 'for', 'of', 'with', 'in', 'on', 'to', 'and', 'or', 'at', 'by'])
function trimTrailingStopwords(words: string[]): string[] {
  const out = [...words]
  while (out.length > 1 && TRAILING_STOPWORDS.has(out[out.length - 1].toLowerCase())) {
    out.pop()
  }
  return out
}

// Used when the description has too few distinct sentences to give every
// feature its own — a short one- or two-sentence description shouldn't
// produce three features with the identical headline.
const GENERIC_FEATURE_HEADLINES = ['Built To Last', 'Quality You Can Trust', 'Designed For Everyday Use', 'Reliable By Design', 'Crafted With Care']

export function draftSectionCopyHeuristically(input: {
  productName: string
  description: string
  sectionCount: number
}): DraftedSection[] {
  const featureCount = Math.max(1, input.sectionCount - 2)
  const sentences = splitSentences(input.description)
  const fallbackSentence = input.description.trim() || input.productName

  const hero: DraftedSection = {
    role: 'hero',
    headline: truncateWords(input.productName, 6),
    body: truncateWords(sentences[0] ?? fallbackSentence, 12)
  }

  const remainingSentences = sentences.length > 1 ? sentences.slice(1) : sentences
  const features: DraftedSection[] = Array.from({ length: featureCount }, (_, i) => {
    const sentence = remainingSentences[i] ?? fallbackSentence
    const headline = remainingSentences[i]
      ? truncateWords(titleCase(trimTrailingStopwords(sentence.split(/\s+/).slice(0, 5)).join(' ')), 5)
      : GENERIC_FEATURE_HEADLINES[i % GENERIC_FEATURE_HEADLINES.length]
    return { role: 'feature', headline, body: truncateWords(sentence, 14) }
  })

  const cta: DraftedSection = {
    role: 'cta',
    headline: 'Order Yours Today',
    body: 'Cash on delivery — fast, easy ordering.'
  }

  return [hero, ...features, cta]
}
