import type { LandingLanguage } from '@amalice/shared'

// Everything that keeps AI-written landing-page copy clean and honest:
//  - sanitizeText strips what makes text render badly (invisible/bidi control
//    characters, tatweel stretching, Arabic presentation forms, doubled
//    punctuation, emoji);
//  - validateCopy checks the language, length, dialect, invented numbers and
//    invented promotions, and reports what is wrong in words the model can act
//    on when it is asked to fix it;
//  - the fixed phrases/fallback copy guarantee a usable page even when the
//    model keeps failing validation.

export interface CopySection {
  role: 'hero' | 'feature' | 'cta'
  headline: string
  body: string
}

// ---- sanitizing ----

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'

export function toAsciiDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/[۰-۹]/g, (d) => String(EXT_ARABIC_INDIC.indexOf(d)))
}

export function sanitizeText(input: string): string {
  return input
    .normalize('NFKC') // folds Arabic presentation forms (ﻷ, ﻻ…) back to base letters
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '') // zero-width + bidi controls
    .replace(/ـ/g, '') // tatweel
    .replace(/[ؐ-ًؚ-ٰٟ]/g, '') // diacritics: they render unevenly at display sizes
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{FE0F}]/gu, '') // emoji / dingbats
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\.{2,}|…/g, '…')
    .replace(/([!؟?،,.:؛;])\1+/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+([،,.!؟?:؛;])/g, '$1')
    .trim()
}

// ---- validation ----

const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۼ]/g
const LATIN_LETTER = /[A-Za-z]/g

// Colloquial markers (Algerian / Gulf / Egyptian / Levantine): the page is MSA only.
const DIALECT_WORDS = [
  'واش', 'بزاف', 'ديال', 'ديالك', 'نتاع', 'نتاعك', 'علاش', 'كيفاش', 'برشا', 'شوية', 'هاذا', 'هاذي', 'هادي', 'هادا', 'دير', 'ديرو', 'راهو', 'راهي',
  'مش', 'ازاي', 'دلوقتي', 'ليش', 'شلون', 'وايد', 'زين', 'يلا', 'حبيبي', 'فيك', 'عندك', 'بدك', 'هلق', 'كتير', 'شو', 'ايش', 'اللي'
]

// Promotions/urgency the model must never add unless the product source says so.
const CLAIM_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /عرض\s*(محدود|خاص|حصري)|لفترة\s*محدودة|الكمية\s*محدودة|كمية\s*محدودة|آخر\s*فرصة|اخر\s*فرصة|قبل\s*نفاد|ينتهي\s*العرض|لا\s*تفوت/, label: 'urgency / limited offer' },
  { re: /خصم|تخفيض|تخفيضات|سعر\s*مخفض|تصفية/, label: 'discount' },
  { re: /(^|[^ء-ي])(مجان(ا|ي|ية)?|بالمجان)(?![ء-ي])/, label: '"free"' },
  { re: /ضمان|يضمن|مضمون/, label: 'guarantee' },
  { re: /الأفضل\s*في\s*العالم|رقم\s*1|الأول\s*عالميا/, label: 'superlative claim' },
  { re: /%/, label: 'percentage' },
  { re: /\b(sale|free|discount|limited|guarantee)\b/i, label: 'promotion (latin)' },
  { re: /\b(soldes?|gratuit|remise|offre limit[ée]e|garantie)\b/i, label: 'promotion (french)' }
]

function plain(text: string): string {
  return toAsciiDigits(sanitizeText(text)).toLowerCase()
}

function letterStats(text: string) {
  const ar = (text.match(ARABIC_LETTER) ?? []).length
  const lat = (text.match(LATIN_LETTER) ?? []).length
  return { ar, lat, total: ar + lat }
}

export interface ValidateContext {
  language: LandingLanguage
  sectionCount: number
  // Everything the model was given (description, benefits…, product name,
  // owner instructions): numbers and promotions are only allowed if they appear here.
  sourceText: string
}

export interface CopyIssue {
  index: number | null
  message: string
}

function fieldIssues(text: string, where: string, field: string, index: number | null, ctx: ValidateContext, source: string): CopyIssue[] {
  const issues: CopyIssue[] = []
  const low = plain(text)
  if (ctx.language === 'ar') {
    // Latin tokens are fine only when they come from the source (a brand / model name).
    const foreign = (text.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? []).filter((w) => !source.includes(w.toLowerCase()))
    const { ar, total } = letterStats(text)
    if (foreign.length) issues.push({ index, message: `${where}: the ${field} contains non-Arabic words (${foreign.slice(0, 3).join(', ')}) that are not in the product information. Write it in Modern Standard Arabic.` })
    else if (total > 0 && ar / total < 0.6) issues.push({ index, message: `${where}: the ${field} must be in Arabic.` })
    const dialect = DIALECT_WORDS.filter((w) => new RegExp('(^|\\s)' + w + '(\\s|$|[،.!؟])').test(low))
    if (dialect.length) issues.push({ index, message: `${where}: the ${field} uses colloquial words (${dialect.slice(0, 3).join(', ')}). Use formal Modern Standard Arabic only.` })
  } else {
    const { ar, total } = letterStats(text)
    if (total > 0 && ar > 0) issues.push({ index, message: `${where}: the ${field} must not contain Arabic when the page language is ${ctx.language}.` })
  }
  // Numbers must come from the product information.
  for (const num of low.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!source.includes(num)) issues.push({ index, message: `${where}: the ${field} contains the number "${num}", which is not in the product information. Remove invented numbers.` })
  }
  // Promotions / urgency / guarantees must be supported by the source.
  for (const { re, label } of CLAIM_PATTERNS) {
    if (re.test(text) && !re.test(ctx.sourceText)) issues.push({ index, message: `${where}: the ${field} makes a ${label} claim that is not in the product information. Remove it.` })
  }
  return issues
}

// For free-standing lines (a funnel's headline / subheadline / button label).
export function validateLine(text: string, where: string, field: string, ctx: ValidateContext, maxWords: number): CopyIssue[] {
  const clean = sanitizeText(text)
  const issues: CopyIssue[] = []
  if (!clean) return [{ index: null, message: `${where}: the ${field} is empty.` }]
  if (clean.split(/\s+/).length > maxWords) issues.push({ index: null, message: `${where}: the ${field} is too long (max ${maxWords} words).` })
  if (/…$/.test(clean)) issues.push({ index: null, message: `${where}: the ${field} must be complete, never cut off with "…".` })
  return [...issues, ...fieldIssues(clean, where, field, null, ctx, plain(ctx.sourceText))]
}

export function validateCopy(sections: CopySection[], ctx: ValidateContext): CopyIssue[] {
  const issues: CopyIssue[] = []
  const source = plain(ctx.sourceText)

  if (sections.length !== ctx.sectionCount) issues.push({ index: null, message: `Expected exactly ${ctx.sectionCount} sections, got ${sections.length}.` })
  sections.forEach((s, i) => {
    const expected = i === 0 ? 'hero' : i === ctx.sectionCount - 1 ? 'cta' : 'feature'
    if (s.role !== expected) issues.push({ index: i, message: `Section ${i + 1} must have role "${expected}".` })
  })

  const seen = new Set<string>()
  sections.forEach((s, i) => {
    const headline = sanitizeText(s.headline)
    const body = sanitizeText(s.body)
    const where = `Section ${i + 1} (${s.role})`
    const words = (t: string) => t.split(/\s+/).filter(Boolean).length

    if (!headline) issues.push({ index: i, message: `${where}: the headline is empty.` })
    if (!body) issues.push({ index: i, message: `${where}: the supporting line is empty.` })
    const maxHeadline = s.role === 'feature' ? 6 : 7
    if (words(headline) > maxHeadline) issues.push({ index: i, message: `${where}: the headline has ${words(headline)} words; the maximum is ${maxHeadline}.` })
    if (words(body) > 18) issues.push({ index: i, message: `${where}: the supporting line has ${words(body)} words; the maximum is 18.` })
    if (/…$/.test(headline) || /…$/.test(body)) issues.push({ index: i, message: `${where}: text must be complete, never cut off with "…".` })

    const key = plain(headline)
    if (key && seen.has(key)) issues.push({ index: i, message: `${where}: the headline repeats another section's headline.` })
    seen.add(key)

    for (const [field, text] of [['headline', headline], ['supporting line', body]] as const) {
      issues.push(...fieldIssues(text, where, field, i, ctx, source))
    }
  })
  return issues
}

// ---- fixed phrases (always correct, no AI) ----

export const CTA_BUTTON: Record<LandingLanguage, string> = {
  ar: 'اطلب الآن والدفع عند الاستلام',
  fr: 'Commander · Payer à la livraison',
  en: 'Order now · Pay on delivery'
}

const CTA_FALLBACK: Record<LandingLanguage, { headline: string; body: string }> = {
  ar: { headline: 'اطلب منتجك الآن', body: 'الدفع عند الاستلام وطلب بسيط وسهل' },
  fr: { headline: 'Commandez maintenant', body: 'Paiement à la livraison, commande simple' },
  en: { headline: 'Order yours now', body: 'Pay on delivery, ordering is simple' }
}

function words(text: string, max: number): string {
  const parts = sanitizeText(text).split(/\s+/).filter(Boolean)
  return parts.slice(0, max).join(' ')
}

function sentences(text: string): string[] {
  return sanitizeText(text.replace(/\n+/g, '. '))
    .split(/(?<=[.!؟?])\s+/)
    .map((s) => s.replace(/^[-•*\d.\s]+/, '').replace(/[.!؟?:]+$/, '').trim())
    .filter((s) => s.length > 8)
}

// Last-resort copy built straight from the product information — plain, but
// accurate, and passes validation by construction. Used only when the model
// cannot produce valid copy after several attempts, or no key is configured.
export function fallbackCopy(input: { productName: string; description: string; sectionCount: number; language: LandingLanguage }): CopySection[] {
  const featureCount = Math.max(1, input.sectionCount - 2)
  const list = sentences(input.description).filter((s) => s.toLowerCase() !== input.productName.toLowerCase())
  const hero: CopySection = { role: 'hero', headline: words(input.productName, 7), body: words(list[0] ?? input.productName, 18) }
  const features: CopySection[] = Array.from({ length: featureCount }, (_, i) => {
    const sentence = list[i + 1] ?? list[i] ?? input.productName
    return { role: 'feature', headline: words(sentence, 5), body: words(sentence, 18) }
  })
  return [hero, ...features, { role: 'cta', ...CTA_FALLBACK[input.language] }]
}
