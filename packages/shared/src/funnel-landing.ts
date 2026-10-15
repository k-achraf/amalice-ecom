import { z } from 'zod'

// Landing-page settings of a funnel's Landing step. Every landing page has the
// same backbone, top to bottom:
//   1. product photos
//   2. title (headline + optional subheadline)
//   3. the order form, showing the price and the product's offers
//   4. the rest of the page: description, benefits, specs, reviews, FAQ…
// Templates change how that backbone is drawn (photo carousel vs side-by-side,
// compact, sticky button…) and which "details" sections start enabled. Only the
// details (4) can be reordered or turned off; 1-3 are always there.
// Templates are a static catalog in code, like FUNNEL_TEMPLATES: adding one is a
// code change that ships with the storefront renderer for it. The admin preview
// renders from the same data the storefront will use.

// The "rest of the page" blocks — all optional, reorderable.
export const LandingSectionTypeSchema = z.enum(['description', 'benefits', 'specs', 'howItWorks', 'testimonials', 'guarantee', 'faq'])
export type LandingSectionType = z.infer<typeof LandingSectionTypeSchema>

export const LANDING_SECTION_META: Record<LandingSectionType, { label: string; description: string; icon: string }> = {
  description: { label: 'Description', description: 'The product description from the catalogue.', icon: 'i-lucide-file-text' },
  benefits: { label: 'Key benefits', description: 'The product’s key benefits as a short checklist.', icon: 'i-lucide-check-circle-2' },
  specs: { label: 'Specifications', description: 'The product’s specification table.', icon: 'i-lucide-list-checks' },
  howItWorks: { label: 'How ordering works', description: 'Three steps explaining cash on delivery.', icon: 'i-lucide-truck' },
  testimonials: { label: 'Customer reviews', description: 'Quotes from happy customers.', icon: 'i-lucide-star' },
  guarantee: { label: 'Guarantees', description: 'Pay on delivery, inspect before paying, easy returns.', icon: 'i-lucide-shield' },
  faq: { label: 'FAQ', description: 'The product’s frequently asked questions.', icon: 'i-lucide-circle-help' }
}

export const LANDING_TEMPLATE_IDS = ['classic', 'side-by-side', 'compact', 'bold', 'image-page'] as const
export const LandingTemplateIdSchema = z.enum(LANDING_TEMPLATE_IDS)
export type LandingTemplateId = z.infer<typeof LandingTemplateIdSchema>

// How the backbone (photos / title / order form) is arranged:
//  stacked — one column: photo carousel, title, order form
//  split   — on wide screens photos on one side, title + order form on the other
//            (still photos → title → form in one column on phones)
//  compact — small photo strip, tighter spacing, form right under the title
//  image   — like stacked, but the details are one long generated image
export type LandingLayout = 'stacked' | 'split' | 'compact' | 'image'

export const LANDING_ACCENTS = ['teal', 'pine', 'brass', 'clay'] as const
export const LandingAccentSchema = z.enum(LANDING_ACCENTS)
export type LandingAccent = z.infer<typeof LandingAccentSchema>
export const LANDING_ACCENT_HEX: Record<LandingAccent, { solid: string; soft: string; label: string }> = {
  teal: { solid: '#1F5F5B', soft: '#E6EDE9', label: 'Teal' },
  pine: { solid: '#0E2928', soft: '#E1E8E6', label: 'Pine' },
  brass: { solid: '#B8892B', soft: '#F6EEDD', label: 'Brass' },
  clay: { solid: '#B4533A', soft: '#F5E3DD', label: 'Clay' }
}

export const ADDRESS_FIELD_MODES = ['required', 'optional', 'hidden'] as const
export const AddressFieldSchema = z.enum(ADDRESS_FIELD_MODES)
export type AddressField = z.infer<typeof AddressFieldSchema>

export interface LandingTemplate {
  id: LandingTemplateId
  name: string
  description: string
  bestFor: string
  layout: LandingLayout
  /** Details sections enabled by default, in order. */
  sections: LandingSectionType[]
  defaults: { ctaLabel: string; accent: LandingAccent; urgency: boolean; addressField: AddressField }
}

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Photo carousel, title, then the order form, with the full product story below.',
    bestFor: 'Most single-product ads',
    layout: 'stacked',
    sections: ['description', 'benefits', 'specs', 'guarantee', 'faq'],
    defaults: { ctaLabel: 'اطلب الآن والدفع عند الاستلام', accent: 'teal', urgency: false, addressField: 'required' }
  },
  {
    id: 'side-by-side',
    name: 'Side by side',
    description: 'Photos beside the title and order form on desktop, one column on phones.',
    bestFor: 'Visitors on desktop and tablets',
    layout: 'split',
    sections: ['benefits', 'description', 'specs', 'testimonials', 'faq'],
    defaults: { ctaLabel: 'اطلب الآن والدفع عند الاستلام', accent: 'pine', urgency: false, addressField: 'required' }
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'A small photo strip so the order form is on screen straight away.',
    bestFor: 'Impulse buys and warm traffic',
    layout: 'compact',
    sections: ['description', 'benefits', 'guarantee'],
    defaults: { ctaLabel: 'اطلب الآن', accent: 'teal', urgency: false, addressField: 'optional' }
  },
  {
    id: 'bold',
    name: 'Bold offer',
    description: 'Urgency banner on top and a button that stays pinned to the bottom of the screen.',
    bestFor: 'Big discounts and trending products',
    layout: 'stacked',
    sections: ['benefits', 'howItWorks', 'testimonials', 'guarantee', 'faq'],
    defaults: { ctaLabel: 'اطلب الآن، الكمية محدودة', accent: 'clay', urgency: true, addressField: 'optional' }
  },
  {
    id: 'image-page',
    name: 'Image page',
    description: 'The same top, then a long page written and designed by AI — generate it right in the editor.',
    bestFor: 'Ads already built around a long image',
    layout: 'image',
    sections: ['guarantee'],
    defaults: { ctaLabel: 'اطلب الآن والدفع عند الاستلام', accent: 'brass', urgency: false, addressField: 'required' }
  }
]

export function getLandingTemplate(id: string): LandingTemplate | undefined {
  return LANDING_TEMPLATES.find((t) => t.id === id)
}

export const LandingSectionSettingSchema = z.object({
  type: LandingSectionTypeSchema,
  enabled: z.boolean()
})
export type LandingSectionSetting = z.infer<typeof LandingSectionSettingSchema>

export const LandingSettingsSchema = z.object({
  templateId: LandingTemplateIdSchema,
  headline: z.string().trim().max(140).nullable().optional(),
  subheadline: z.string().trim().max(280).nullable().optional(),
  // Order form
  ctaLabel: z.string().trim().min(1).max(40),
  showPrice: z.boolean(),
  showOffers: z.boolean(),
  accent: LandingAccentSchema,
  // Optional banner above everything. (The order bar pinned to the bottom of the screen is not a setting: every
  // funnel always has one.)
  urgency: z.boolean(),
  urgencyText: z.string().trim().max(120).nullable().optional(),
  // Conversion levers (all default on/short so older saved settings still parse):
  //  addressField     — fewer fields convert better; the call centre confirms the address by phone
  //  showNotes        — an optional notes box (off keeps the form short)
  //  trustBadges      — pay on delivery / inspect before paying / returns, under the button
  //  quickBenefits    — the first three key benefits right under the price, before the form
  //  showStock        — "Only N left" when real stock is low
  //  preselectBestOffer — start with the best-value offer selected instead of a single unit
  addressField: AddressFieldSchema.default('required'),
  showNotes: z.boolean().default(false),
  trustBadges: z.boolean().default(true),
  quickBenefits: z.boolean().default(true),
  showStock: z.boolean().default(true),
  preselectBestOffer: z.boolean().default(true),
  // The "rest of the page", ordered. Every section the template offers appears once.
  sections: z.array(LandingSectionSettingSchema).max(12),
  // image-page template only: the generated long-image page shown as the details.
  generatedPageId: z.uuid().nullable().optional()
})
export type LandingSettings = z.infer<typeof LandingSettingsSchema>

export function defaultLandingSettings(templateId: LandingTemplateId): LandingSettings {
  const t = getLandingTemplate(templateId)!
  return {
    templateId: t.id,
    headline: null,
    subheadline: null,
    ctaLabel: t.defaults.ctaLabel,
    showPrice: true,
    showOffers: true,
    accent: t.defaults.accent,
    urgency: t.defaults.urgency,
    urgencyText: null,
    addressField: t.defaults.addressField,
    showNotes: false,
    trustBadges: true,
    quickBenefits: true,
    showStock: true,
    preselectBestOffer: true,
    sections: t.sections.map((type) => ({ type, enabled: true })),
    generatedPageId: null
  }
}

// Switching template keeps the admin's copy, colour and order-form choices; the
// look-and-feel switches (urgency banner, sticky button) and the details list
// follow the new template.
export function switchLandingTemplate(current: LandingSettings, templateId: LandingTemplateId): LandingSettings {
  const next = defaultLandingSettings(templateId)
  const prev = new Map(current.sections.map((s) => [s.type, s.enabled]))
  return {
    ...next,
    headline: current.headline ?? null,
    subheadline: current.subheadline ?? null,
    ctaLabel: current.ctaLabel,
    showPrice: current.showPrice,
    showOffers: current.showOffers,
    accent: current.accent,
    urgencyText: current.urgencyText ?? null,
    addressField: current.addressField,
    showNotes: current.showNotes,
    trustBadges: current.trustBadges,
    quickBenefits: current.quickBenefits,
    showStock: current.showStock,
    preselectBestOffer: current.preselectBestOffer,
    sections: next.sections.map((s) => ({ type: s.type, enabled: prev.get(s.type) ?? true })),
    generatedPageId: current.generatedPageId ?? null
  }
}

// Landing settings saved before the description block existed (the Compact
// template never offered it) have no entry for it at all. Treat that as "on, first
// below the form" so the product description always shows, and the editor shows its
// switch. An entry that exists keeps whatever the admin chose. The long-image
// template replaces the details, so it is left alone.
export function withDescriptionSection(settings: LandingSettings): LandingSettings {
  if (getLandingTemplate(settings.templateId)?.layout === 'image') return settings
  if (settings.sections.some((x) => x.type === 'description')) return settings
  return { ...settings, sections: [{ type: 'description', enabled: true }, ...settings.sections] }
}
