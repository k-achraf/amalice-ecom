import { Injectable, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import type { AddressSuggestion } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from './ai.service'

// Lowercase, no diacritics/tashkeel, no punctuation, collapsed spaces — so
// "Sétif", "setif" and "  SETIF " compare equal. Arabic letters pass through.
const fold = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// Guards the cleaned street line against the model rewriting it. Every word of
// `cleaned` must already exist in `original` (compared folded, so accents and
// case don't count as a difference); each one is then written back with the
// ORIGINAL spelling, so the customer's accents/letters survive even if the model
// dropped them. Returns null when the model introduced a word that was not in
// the original — the caller then keeps the original line untouched.
export function restoreOriginalWords(cleaned: string, original: string): string | null {
  const originalByFold = new Map<string, string>()
  for (const word of original.split(/\s+/)) {
    const key = fold(word)
    if (key && !originalByFold.has(key)) originalByFold.set(key, word)
  }
  const restored: string[] = []
  for (const word of cleaned.split(/\s+/).filter(Boolean)) {
    const key = fold(word)
    if (!key) continue // bare punctuation
    const source = originalByFold.get(key)
    if (source === undefined) return null
    restored.push(source)
  }
  return restored.length ? restored.join(' ') : null
}

const WilayaPick = z.object({ wilayaId: z.string().nullable() })

const CommunePick = z.object({
  communeId: z.string().nullable(),
  addressLine1: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string()
})

// Suggests a clean wilaya / commune / street line for an order's address. The
// AI only ever CHOOSES among real rows (the wilayas and communes tables) —
// whatever id it answers is checked against those rows, so a hallucinated
// place can't reach the order. It never writes anything: the result is a
// suggestion for the agent to apply through the audited order correction.
@Injectable()
export class AddressNormalizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async suggestForOrder(orderId: string): Promise<AddressSuggestion> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { address: { select: { line1: true, line2: true, city: true, region: true } } }
    })
    if (!order) throw new NotFoundException('Order not found')
    const { line1, city, region } = order.address

    const wilayas = await this.prisma.wilaya.findMany({ select: { id: true, name: true } })
    const wilayaById = new Map(wilayas.map((w) => [w.id, w]))

    // 1) Wilaya: an exact (folded) name match needs no AI at all.
    let wilaya = wilayas.find((w) => fold(w.name) === fold(region)) ?? null
    if (!wilaya) {
      const pick = await this.ai.generateObject({
        task: 'address-wilaya',
        tier: 'fast',
        prompt: `You match Algerian addresses to wilayas. The customer typed the wilaya as "${region}", the commune/town as "${city}" and the address as "${line1}" (Arabic, French, Latin-script Arabic or mixed, possibly misspelled or abbreviated).
Choose the matching wilaya from this list (id | name):
${wilayas.map((w) => `${w.id} | ${w.name}`).join('\n')}
Answer wilayaId = the id, or null when you cannot tell. Never guess a wilaya that the text does not support.`,
        schema: WilayaPick
      })
      wilaya = pick.wilayaId ? (wilayaById.get(pick.wilayaId) ?? null) : null
    }

    if (!wilaya) {
      return {
        wilayaId: null,
        wilayaName: null,
        communeId: null,
        communeName: null,
        addressLine1: line1,
        confidence: 'low',
        reason: 'Could not identify the wilaya from the address.',
        changed: false
      }
    }

    // 2) Commune: the AI picks from this wilaya's real communes only.
    const communes = await this.prisma.commune.findMany({ where: { wilayaId: wilaya.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    const communeById = new Map(communes.map((c) => [c.id, c]))

    const pick = await this.ai.generateObject({
      task: 'address-commune',
      tier: 'fast',
      prompt: `You clean Algerian delivery addresses. Wilaya: ${wilaya.name}. The customer typed the commune/town as "${city}" and the address as "${line1}" (Arabic, French, Latin-script Arabic or mixed, possibly misspelled).
Communes of this wilaya (id | name):
${communes.map((c) => `${c.id} | ${c.name}`).join('\n')}

Return:
- communeId: the id of the commune the customer means, or null if it is not clearly one of these. Do not guess.
- addressLine1: the street / neighbourhood / landmark part of the address, with ONLY the wilaya and commune names (and pure noise such as repeated or stray punctuation) removed. Copy every remaining word EXACTLY as the customer wrote it: same letters, same accents and diacritics (é, è, à…), same language and script, same numbers. Do NOT correct spelling, translate, transliterate, add, or invent any word. If nothing is left, return the original text.
- confidence: high | medium | low.
- reason: one short English sentence for the agent.`,
      schema: CommunePick
    })

    const commune = pick.communeId ? (communeById.get(pick.communeId) ?? null) : null
    // Never trust the model's wording: keep only words the customer wrote, in
    // the customer's spelling; anything else falls back to the original line.
    const addressLine1 = restoreOriginalWords(pick.addressLine1, line1)?.slice(0, 200) ?? line1
    const changed = wilaya.name !== region || (commune ? commune.name !== city : false) || addressLine1 !== line1

    return {
      wilayaId: wilaya.id,
      wilayaName: wilaya.name,
      communeId: commune?.id ?? null,
      communeName: commune?.name ?? null,
      addressLine1,
      // A commune the AI could not pin down caps the confidence.
      confidence: commune ? pick.confidence : 'low',
      reason: pick.reason,
      changed
    }
  }
}
