import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  LANDING_ACCENTS,
  LandingSettingsSchema,
  LandingSectionTypeSchema,
  ADDRESS_FIELD_MODES,
  defaultLandingSettings,
  getFunnelTemplate,
  type FunnelStepConfig,
  type FunnelStepType,
  type GenerateFunnel,
  type GeneratedFunnelResult,
  type LandingAccent,
  type LandingSectionType,
  type LandingTemplateId
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { GeminiService } from '../landing-pages/gemini.service'
import { FunnelsService } from './funnels.service'

const OFFER_STEPS = ['OrderBump', 'Upsell', 'Downsell'] as const
type OfferStep = (typeof OFFER_STEPS)[number]
const LANDING_TEMPLATES: LandingTemplateId[] = ['classic', 'side-by-side', 'compact', 'bold']
const ALL_SECTIONS = LandingSectionTypeSchema.options
const MAX_DISCOUNT = 30

const clip = (v: unknown, max: number): string | null => {
  const t = typeof v === 'string' ? v.trim().replace(/^["«]|["»]$/g, '').trim() : ''
  return t ? t.slice(0, max) : null
}

// One click from a product to a ready (Draft) funnel. The model proposes, this
// service disposes: every choice is checked against what actually exists
// (templates, catalogue products, schema limits) and falls back to a safe
// default rather than saving something broken.
@Injectable()
export class FunnelsAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly funnels: FunnelsService,
    private readonly audit: AuditService
  ) {}

  async generate(input: GenerateFunnel, actor: AuditActor): Promise<GeneratedFunnelResult> {
    if (!this.gemini.isConfigured()) throw new BadRequestException('The AI is not configured (GEMINI_API_KEY is missing).')
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, slug: true, description: true, priceCents: true, keyBenefits: true, category: true, stockQuantity: true }
    })
    if (!product) throw new NotFoundException('Product not found')

    const others = await this.prisma.product.findMany({
      where: { id: { not: product.id }, visible: true, priceCents: { gt: 0 } },
      orderBy: [{ bestSeller: 'desc' }, { featured: 'desc' }, { createdAt: 'desc' }],
      take: 15,
      select: { id: true, name: true, priceCents: true }
    })
    const byId = new Map(others.map((o) => [o.id, o]))

    let plan
    try {
      plan = await this.gemini.planFunnel({
        product: {
          name: product.name,
          description: (product.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000),
          priceDa: Math.round(product.priceCents / 100),
          keyBenefits: product.keyBenefits,
          category: product.category,
          stock: product.stockQuantity
        },
        candidates: others.map((o) => ({ id: o.id, name: o.name, priceDa: Math.round(o.priceCents / 100) })),
        language: input.language,
        instructions: input.instructions
      })
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof BadGatewayException) throw e
      throw new BadGatewayException('The AI could not plan the funnel — try again.')
    }

    const notes: string[] = []

    // ---- workflow ----
    const template = getFunnelTemplate(plan.workflowId) ?? getFunnelTemplate('classic-cod')!
    if (template.id !== plan.workflowId) notes.push('Unknown workflow suggested — used the classic one.')

    // ---- offers: one distinct catalogue product per offer step; a step with
    // no valid product is dropped instead of saved empty ----
    const used = new Set<string>()
    const offerCfg = new Map<number, FunnelStepConfig>()
    const offersOut: GeneratedFunnelResult['plan']['offers'] = []
    const steps: { type: FunnelStepType; name: string; config: FunnelStepConfig }[] = []
    for (const [i, s] of template.steps.entries()) {
      if (!(OFFER_STEPS as readonly string[]).includes(s.type)) {
        steps.push({ type: s.type, name: s.name, config: {} })
        continue
      }
      const pick = (plan.offers ?? []).find((o) => o.stepType === s.type && byId.has(o.productId) && !used.has(o.productId))
      if (!pick) {
        notes.push(`No suitable catalogue product for the ${s.name} step, so it was left out.`)
        continue
      }
      used.add(pick.productId)
      const p = byId.get(pick.productId)!
      const pct = Math.max(0, Math.min(MAX_DISCOUNT, Math.round(Number(pick.discountPercent) || 0)))
      const cfg: FunnelStepConfig = {
        offerProductId: p.id,
        priceCentsOverride: pct > 0 ? Math.round((p.priceCents * (100 - pct)) / 100) : null,
        headline: clip(pick.headline, 140)
      }
      offerCfg.set(i, cfg)
      offersOut.push({ stepType: s.type as OfferStep, productName: p.name, discountPercent: pct })
      steps.push({ type: s.type, name: s.name, config: cfg })
    }

    // ---- landing settings (only when the workflow has a Landing step) ----
    const landingStep = steps.find((s) => s.type === 'Landing')
    if (landingStep) {
      const tid = (LANDING_TEMPLATES as string[]).includes(plan.landingTemplateId) ? (plan.landingTemplateId as LandingTemplateId) : 'classic'
      const base = defaultLandingSettings(tid)
      const accent: LandingAccent = (LANDING_ACCENTS as readonly string[]).includes(plan.accent) ? (plan.accent as LandingAccent) : base.accent
      const chosen = [...new Set((plan.sections ?? []).filter((x): x is LandingSectionType => (ALL_SECTIONS as readonly string[]).includes(x)))]
      const sections = chosen.length
        ? [...chosen.map((type) => ({ type, enabled: true })), ...ALL_SECTIONS.filter((t) => !chosen.includes(t)).map((type) => ({ type, enabled: false }))]
        : base.sections
      const urgency = !!plan.urgency
      const candidate = {
        ...base,
        headline: clip(plan.headline, 140),
        subheadline: clip(plan.subheadline, 280),
        ctaLabel: clip(plan.ctaLabel, 40) ?? base.ctaLabel,
        accent,
        urgency,
        urgencyText: urgency ? clip(plan.urgencyText, 120) : null,
        addressField: (ADDRESS_FIELD_MODES as readonly string[]).includes(plan.addressField) ? (plan.addressField as (typeof ADDRESS_FIELD_MODES)[number]) : base.addressField,
        showNotes: !!plan.showNotes,
        trustBadges: !!plan.trustBadges,
        quickBenefits: !!plan.quickBenefits,
        showStock: !!plan.showStock,
        preselectBestOffer: !!plan.preselectBestOffer,
        sections
      }
      const parsed = LandingSettingsSchema.safeParse(candidate)
      if (parsed.success) landingStep.config = { landing: parsed.data }
      else {
        notes.push('Some AI landing settings were invalid, so template defaults were used for them.')
        landingStep.config = { landing: { ...base, headline: clip(plan.headline, 140), subheadline: clip(plan.subheadline, 280) } }
      }
    }

    const name = clip(plan.name, 100) ?? product.name.slice(0, 100)
    const funnel = await this.funnels.createWithSteps({ name, productId: product.id, templateId: template.id, slugBase: `${product.slug}-funnel`, steps }, actor)
    await this.audit.log({
      actor,
      action: 'Create',
      entity: 'Funnel',
      entityId: funnel.id,
      metadata: { aiGenerated: true, templateId: template.id, language: input.language, offers: offersOut.length }
    })

    return {
      funnel,
      plan: {
        workflowReason: clip(plan.workflowReason, 300) ?? '',
        templateReason: landingStep ? (clip(plan.templateReason, 300) ?? '') : '',
        offers: offersOut,
        notes
      }
    }
  }
}
