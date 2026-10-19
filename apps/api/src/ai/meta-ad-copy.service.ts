import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common'
import { META_AD_LIMITS, MetaAdCopyModelSchema, type GenerateMetaAdCopy, type MetaAdAngle, type MetaAdCopyResult } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { sanitizeText, validateLine, type ValidateContext } from '../landing-pages/landing-copy.util'
import { AiService } from './ai.service'

const MAX_ATTEMPTS = 3

const LANGUAGE_RULES = {
  ar: 'Write in clear Modern Standard Arabic (الفصحى), never in dialect.',
  fr: 'Write in correct, natural French.'
} as const

// Meta ad copy: several angles per product, held to the same rules as the AI
// landing pages (landing-copy.util): the language must be right, and numbers,
// discounts, urgency, guarantees and other promotions are allowed ONLY when
// they appear in the product's own data (or the owner's brief). The model's
// output is checked line by line; angles that break a rule are re-asked with
// the exact problems, and any that still fail are dropped, never published.
@Injectable()
export class MetaAdCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async generate(input: GenerateMetaAdCopy): Promise<MetaAdCopyResult> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: { name: true, description: true, keyBenefits: true, category: true, priceCents: true }
    })
    if (!product) throw new NotFoundException('Product not found')

    // The ONLY facts the copy may rest on. The price is listed so it can be quoted,
    // but there is deliberately no compare-at / old price: no discount can be derived.
    const price = Math.round(product.priceCents / 100)
    const facts = [
      `Name: ${product.name}`,
      product.category ? `Category: ${product.category}` : null,
      product.description ? `Description: ${product.description}` : null,
      product.keyBenefits.length ? `Key benefits:\n${product.keyBenefits.map((b) => `- ${b}`).join('\n')}` : null,
      `Price: ${price} DZD, cash on delivery`,
      input.instructions ? `Owner's brief: ${input.instructions}` : null
    ].filter((l): l is string => !!l)
    const ctx: ValidateContext = { language: input.language, sectionCount: 0, sourceText: facts.join('\n') }

    const good: MetaAdAngle[] = []
    let rejected = 0
    let feedback = ''
    for (let attempt = 0; attempt < MAX_ATTEMPTS && good.length < input.angleCount; attempt++) {
      const need = input.angleCount - good.length
      const taken = good.map((g) => g.angle)
      const out = await this.ai.generateObject({
        task: 'meta-ad-copy',
        tier: 'smart',
        temperature: 0.7,
        schema: MetaAdCopyModelSchema,
        prompt: `You write Meta (Facebook/Instagram) ads for a cash-on-delivery store in Algeria. ${LANGUAGE_RULES[input.language]} No emoji, no hashtags, no markdown.

Product information (the ONLY source of facts):
${facts.join('\n')}

Write ${need} ads, each built on a DIFFERENT marketing angle chosen from what the product information supports (for example: the problem it solves, a main benefit, ease of use, gift idea, comparison with the usual alternative, daily-life scene). ${taken.length ? `Angles already used, do not repeat: ${taken.join(', ')}.` : ''}

Per ad return:
- angle: a short internal name for the angle (English, 2-4 words).
- primaryText: the ad body, at most ${META_AD_LIMITS.primaryWords} words and ${META_AD_LIMITS.primaryText} characters. Put the strongest point in the first 125 characters.
- headlines: 3 different attention-grabbing headlines, each at most ${META_AD_LIMITS.headlineWords} words and ${META_AD_LIMITS.headline} characters.
- description: a short line under the headline, at most ${META_AD_LIMITS.descriptionWords} words and ${META_AD_LIMITS.description} characters.

Strict rules:
- Use ONLY facts from the product information. Do not invent features, materials, results, ingredients, certifications, statistics, reviews or customer counts.
- No discount, sale, promo, "free", "limited", "last chance", countdown, guarantee, percentage or superlative claim unless that exact claim is in the product information. The price may be quoted exactly as given.
- You may say the customer pays on delivery (it is how the store works).
- Every ad must be complete (no trailing "…").${feedback}`
      })

      const seenHeadlines = new Set(good.flatMap((g) => g.headlines.map((h) => sanitizeText(h).toLowerCase())))
      const problems: string[] = []
      for (const raw of out.angles) {
        if (good.length >= input.angleCount) break
        const angle = this.clean(raw)
        const where = `Angle "${angle.angle}"`
        const issues = [
          ...validateLine(angle.primaryText, where, 'primary text', ctx, META_AD_LIMITS.primaryWords),
          ...(angle.primaryText.length > META_AD_LIMITS.primaryText ? [{ index: null, message: `${where}: the primary text is longer than ${META_AD_LIMITS.primaryText} characters.` }] : []),
          ...angle.headlines.flatMap((h) => [
            ...validateLine(h, where, 'headline', ctx, META_AD_LIMITS.headlineWords),
            ...(h.length > META_AD_LIMITS.headline ? [{ index: null, message: `${where}: the headline "${h}" is longer than ${META_AD_LIMITS.headline} characters.` }] : [])
          ]),
          ...validateLine(angle.description, where, 'description', ctx, META_AD_LIMITS.descriptionWords),
          ...(angle.description.length > META_AD_LIMITS.description ? [{ index: null, message: `${where}: the description is longer than ${META_AD_LIMITS.description} characters.` }] : [])
        ]
        const repeated = angle.headlines.some((h) => seenHeadlines.has(h.toLowerCase()))
        if (repeated) issues.push({ index: null, message: `${where}: a headline repeats another ad's headline.` })
        if (issues.length) {
          rejected++
          problems.push(...issues.map((i) => `- ${i.message}`))
          continue
        }
        angle.headlines.forEach((h) => seenHeadlines.add(h.toLowerCase()))
        good.push(angle)
      }
      feedback = problems.length ? `\n\nYour previous attempt had these problems; fix every one in the new ads:\n${problems.slice(0, 12).join('\n')}` : ''
    }

    if (good.length === 0) throw new BadGatewayException('The AI could not write ad copy that follows the rules (it kept adding claims that are not in the product data). Try again or add more detail to the product description.')
    return { productId: input.productId, productName: product.name, language: input.language, angles: good, rejected }
  }

  private clean(a: MetaAdAngle): MetaAdAngle {
    return {
      angle: sanitizeText(a.angle),
      primaryText: sanitizeText(a.primaryText),
      headlines: a.headlines.map(sanitizeText).filter(Boolean),
      description: sanitizeText(a.description)
    }
  }
}
