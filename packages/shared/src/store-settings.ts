import { z } from 'zod'

// The storefront template registry — the single source of truth for which
// templates exist. Both the API (validating the admin's PUT) and the
// storefront (resolving the layout) consult this, so a template can't be
// selected that the storefront can't render (and vice versa).
//
// Each template carries its own design language (2026-07 re-theme) — not a
// single shared Polaris palette re-spaced four ways. minimal stays Polaris
// (polaris-design-language skill); editorial/boutique/promify each layer a
// scoped token file (apps/storefront/app/assets/css/{editorial,boutique,
// promify}.css) that overrides Nuxt UI's --ui-* variables under a .tpl-*
// wrapper class, so color, radius, shadow, and type genuinely differ per
// template instead of just density/composition. nova and atelier (2026-07)
// go further still — they render zero @nuxt/ui components at all, hand-built
// from plain Tailwind (components/{nova,atelier}/ui/*), so there's nothing
// to re-skin via Nuxt UI's tokens in the first place.
export const STORE_TEMPLATES = ['minimal', 'editorial', 'boutique', 'promify', 'nova', 'atelier', 'drop', 'bloom', 'hearth', 'volt', 'pulse', 'lumiere', 'trove', 'forge', 'impulse'] as const
export type StoreTemplate = (typeof STORE_TEMPLATES)[number]

export const StoreTemplateSchema = z.enum(STORE_TEMPLATES)

// Human metadata for the admin picker — name, description, best-for blurb.
// Kept here so the admin and any future docs surface agree.
export const TEMPLATE_META: Record<
  StoreTemplate,
  { label: string; description: string; bestFor: string }
> = {
  minimal: {
    label: 'Minimal',
    description: 'Shopify Polaris. Clean, sparse, utility-first — near-black actions, tight type, flat-but-layered shadows.',
    bestFor: 'General stores and everyday goods'
  },
  editorial: {
    label: 'Editorial',
    description: 'Magazine scale with Atlassian Design System structure. Bold display headlines, ADS blue kickers/lozenges, small crisp radius, sentence-case labels.',
    bestFor: 'Lifestyle and curated brands'
  },
  boutique: {
    label: 'Boutique',
    description: 'A bespoke quiet-luxury system. Warm ivory & near-black ink, Fraunces serif display type, zero radius, no shadows, a single restrained gold accent.',
    bestFor: 'Premium single-vendor stores'
  },
  promify: {
    label: 'Promify',
    description: 'Stripe visual language. Indigo primary, navy-tinted soft shadows with a signature hover glow, rounder cards, glassy sticky header, gradient hero.',
    bestFor: 'General retail and promotional stores'
  },
  nova: {
    label: 'Nova',
    description: 'Modern neubrutalist commerce, built with plain Tailwind (no component library at all). Thick black borders, hard offset shadows, one loud lime accent, heavy display type.',
    bestFor: 'Bold, contemporary direct-to-consumer brands'
  },
  atelier: {
    label: 'Atelier',
    description: 'Fine jewelry & accessories, built with plain Tailwind (no component library at all). Warm cream shopping surface, deep emerald-black velvet moments, a rose-gold accent, soft glowing shadows, fully rounded shapes, delicate Cormorant serif.',
    bestFor: 'Jewelry, watches, and fine accessories'
  },
  drop: {
    label: 'Drop',
    description: 'Streetwear hype-drop energy, built with plain Tailwind (no component library at all). Black surface, a fiery red-orange accent, ultra-condensed Anton display type, sharp corners, flat (no shadow) contrast, diagonal sticker tags.',
    bestFor: 'Streetwear, sneakers, and limited-drop brands'
  },
  bloom: {
    label: 'Bloom',
    description: 'Soft beauty & cosmetics system, built with plain Tailwind (no component library at all). Airy blush-cream surface, a bubblegum-pink accent, rounded Poppins display type, rounded-3xl cards and full-pill buttons, a soft blooming glow shadow.',
    bestFor: 'Beauty, skincare, and cosmetics'
  },
  hearth: {
    label: 'Hearth',
    description: 'Warm home & furniture system, built with plain Tailwind (no component library at all). Sandy linen surface, terracotta + sage accents, Lora serif display type, cozy rounded-xl corners, a subtle grounded shadow, framed-photo product cards.',
    bestFor: 'Home goods, furniture, and interiors'
  },
  volt: {
    label: 'Volt',
    description: 'Dark-mode-first tech & gadgets system, built with plain Tailwind (no component library at all). Near-black surface, an electric cyan accent, geometric Sora display type paired with tabular JetBrains Mono specs, tight sharp radius, hairline borders, a blueprint grid-line motif.',
    bestFor: 'Tech, gadgets, and electronics'
  },
  pulse: {
    label: 'Pulse',
    description: 'Bright glossy consumer-tech system, built with plain Tailwind (no component library at all). White surface, a violet-to-cyan gradient-mesh accent, rounded Outfit display type, rounded-2xl cards, a colorful soft glow shadow — the light-mode opposite of Volt.',
    bestFor: 'Gadgets and consumer electronics'
  },
  lumiere: {
    label: 'Lumière',
    description: 'Bold black/white/crimson beauty-editorial system, built with plain Tailwind (no component library at all). Stark high-contrast surface, oversized Bodoni Moda display serif, sharp minimal radius, a diagonal-cut hero, no shadow — a loud magazine spread, not a soft pastel shelf.',
    bestFor: 'Cosmetics and beauty brands'
  },
  trove: {
    label: 'Trove',
    description: 'Warm collected-treasures accessories system, built with plain Tailwind (no component library at all). Cream surface, a mustard + deep-teal duo-tone accent, quirky Bricolage Grotesque display type, mixed radius (circular photo crops against sharp card frames), a soft warm shadow.',
    bestFor: 'Accessories, bags, and everyday-carry brands'
  },
  forge: {
    label: 'Forge',
    description: 'Raw industrial workshop system, built with plain Tailwind (no component library at all). Concrete-gray surface, a safety-yellow accent, condensed Oswald display type, sharp corners, thick 3px borders, a hazard-stripe motif, no shadow.',
    bestFor: 'Tools, hardware, and workshop supplies'
  },
  impulse: {
    label: 'Impulse',
    description: 'Direct-response funnel system — unlike every other template, it is built around conversion, not browsing. Distraction-free chrome with no nav links, single-column persuasion-ordered pages, an animated glowing CTA, countdown urgency, scarcity bars, social-proof tickers, and trust/guarantee blocks on every page.',
    bestFor: 'Single-product offers and high-converting COD funnels'
  }
}

// The public storefront-facing config (GET /settings) — what the storefront
// server-plugin prefetches to resolve the active template + chrome copy.
export const StoreSettingsSchema = z.object({
  activeTemplate: StoreTemplateSchema,
  storeName: z.string().min(1).max(100),
  announcementText: z.string().max(200).nullable().optional(),
  displayCart: z.boolean().default(true),
  leadFormConfig: z.array(z.object({
    id: z.string(),
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'tel', 'email', 'number', 'select', 'textarea']).default('text'),
    placeholder: z.string().optional(),
    required: z.boolean().default(true),
    enabled: z.boolean().default(true),
    options: z.array(z.string()).optional(),
    isCore: z.boolean().optional(),
    halfWidth: z.boolean().optional(),
    // Visibility scope: undefined/empty = every product's lead form (the
    // original, only behavior before this field existed) — a non-empty list
    // restricts the field to just those products' PDP/landing-page lead
    // forms, for a custom field that only makes sense on some products (e.g.
    // "Preferred size" on a clothing item, meaningless on a mug). Checked
    // client-side against the current product's id — see products/[slug].vue
    // and lp/[productSlug]/[number].vue's leadFields computed. Never applies
    // to cart checkout.vue (multi-product, no single product to scope
    // against) — that page only ever shows globally-scoped fields.
    productIds: z.array(z.uuid()).optional()
  })).nullable().optional(),
  // How long (seconds) a customer can go idle after typing a phone number on
  // a lead form, without submitting, before the storefront auto-creates an
  // abandoned-cart order (see AbandonedLeadOrderSchema in order.ts).
  abandonedCartDelaySeconds: z.number().int().min(10).max(3600).default(60)
})
export type StoreSettings = z.infer<typeof StoreSettingsSchema>

export type LeadFormField = NonNullable<StoreSettings['leadFormConfig']>[0]

// Default lead form fields (used when leadFormConfig is null). wilaya/commune
// are 'select' — LeadFormFields.vue special-cases these two core keys to
// render cascading dropdowns backed by GET /wilayas + GET /communes?wilayaId=
// (real Algeria data) instead of the generic admin-typed `options` list.
export const DEFAULT_LEAD_FORM_FIELDS: LeadFormField[] = [
  { id: 'name', key: 'name', label: 'Full name', type: 'text', placeholder: 'Your name', required: true, enabled: true, isCore: true },
  { id: 'phone', key: 'phone', label: 'Phone', type: 'tel', placeholder: '+213...', required: true, enabled: true, isCore: true },
  { id: 'wilaya', key: 'wilaya', label: 'Wilaya', type: 'select', placeholder: 'Select wilaya', required: true, enabled: true, isCore: true, halfWidth: true },
  { id: 'commune', key: 'commune', label: 'Commune', type: 'select', placeholder: 'Select commune', required: true, enabled: true, isCore: true, halfWidth: true }
]

// Admin update payload — same fields, all editable.
export const UpdateStoreSettingsSchema = StoreSettingsSchema
export type UpdateStoreSettings = z.infer<typeof UpdateStoreSettingsSchema>
