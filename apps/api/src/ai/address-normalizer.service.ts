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
- addressLine1: the street / neighbourhood / landmark part of the address, with the wilaya and commune names removed and obvious typos and noise fixed. Keep the customer's language. Do NOT add or invent any detail that is not in the original text; if nothing is left, return the original text.
- confidence: high | medium | low.
- reason: one short English sentence for the agent.`,
      schema: CommunePick
    })

    const commune = pick.communeId ? (communeById.get(pick.communeId) ?? null) : null
    const addressLine1 = pick.addressLine1.trim().slice(0, 200) || line1
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
