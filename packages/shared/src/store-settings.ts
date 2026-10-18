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
export const STORE_TEMPLATES = ['minimal', 'editorial', 'boutique', 'promify', 'nova', 'atelier', 'drop', 'bloom', 'hearth', 'volt', 'pulse', 'lumiere', 'trove', 'forge', 'impulse', 'quartz'] as const
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
  },
  quartz: {
    label: 'Quartz',
    description: 'Mobile-first single-product COD order page, built with plain Tailwind (no component library at all). Warm beige-and-espresso surface with a brass/gold accent, a lean single scroll (gallery, variant pills, order form, itemized product/delivery/total price table, sticky bottom buy bar) — deliberately a tight recreation of a proven high-converting Shopify COD order-page layout rather than a full browsing storefront. Only the product page and the AI landing-page funnel are templated; every other page (home, catalog, cart, checkout) falls back to Minimal.',
    bestFor: 'Single-product luxury/accessory offers (jewelry, watches) sold via ad-driven COD funnels'
  }
}

// ---- Brand identity ----
// Colour, typeface and logos the admin controls from Settings → Brand. The
// storefront turns this into CSS variables at SSR time (see
// apps/storefront/app/composables/useBrandHead.ts), so every template — each
// with its own palette — can be re-branded without touching template CSS.

// Arabic-capable Google Fonts the storefront can load on demand. `cairo` is the
// build-time default (already self-hosted); the rest are fetched from Google
// Fonts only when selected. `tone` is what the logo analysis matches against.
export const BRAND_FONTS = [
  { id: 'cairo', label: 'Cairo', family: 'Cairo', tone: 'modern, clean, neutral', weights: '300;400;500;600;700;900' },
  { id: 'tajawal', label: 'Tajawal', family: 'Tajawal', tone: 'light, contemporary, friendly', weights: '300;400;500;700;900' },
  { id: 'almarai', label: 'Almarai', family: 'Almarai', tone: 'simple, corporate, readable', weights: '300;400;700;800' },
  { id: 'ibm-plex-sans-arabic', label: 'IBM Plex Sans Arabic', family: 'IBM Plex Sans Arabic', tone: 'technical, precise, tech', weights: '300;400;500;600;700' },
  { id: 'noto-kufi-arabic', label: 'Noto Kufi Arabic', family: 'Noto Kufi Arabic', tone: 'geometric, bold, strong', weights: '300;400;500;600;700;900' },
  { id: 'readex-pro', label: 'Readex Pro', family: 'Readex Pro', tone: 'soft, rounded, approachable', weights: '300;400;500;600;700' },
  { id: 'changa', label: 'Changa', family: 'Changa', tone: 'energetic, youthful, sporty', weights: '300;400;500;600;700' },
  { id: 'el-messiri', label: 'El Messiri', family: 'El Messiri', tone: 'elegant, classic, premium', weights: '400;500;600;700' },
  { id: 'amiri', label: 'Amiri', family: 'Amiri', tone: 'traditional calligraphic serif, heritage, luxury', weights: '400;700' },
  { id: 'lalezar', label: 'Lalezar', family: 'Lalezar', tone: 'heavy display, playful, headline impact', weights: '400' }
] as const
export type BrandFontId = (typeof BRAND_FONTS)[number]['id']
export const BRAND_FONT_IDS = BRAND_FONTS.map((f) => f.id) as [BrandFontId, ...BrandFontId[]]

// Google Fonts stylesheet for a brand font. null for the build-time default
// (Cairo is self-hosted by @nuxt/fonts, no extra request needed).
export function brandFontStylesheetUrl(fontId: BrandFontId | null | undefined): string | null {
  const font = BRAND_FONTS.find((f) => f.id === fontId)
  if (!font || font.id === 'cairo') return null
  const family = font.family.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${font.weights}&display=swap`
}

// CSS-font-family string for a brand font, always falling back to Cairo.
export function brandFontFamily(fontId: BrandFontId | null | undefined): string {
  const font = BRAND_FONTS.find((f) => f.id === fontId)
  const first = font && font.id !== 'cairo' ? `'${font.family}', ` : ''
  return `${first}'Cairo', ui-sans-serif, system-ui, sans-serif`
}

export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #1a73e8')

export const BrandSchema = z.object({
  // Relative /uploads/... path or absolute URL (resolve with resolveImageUrl).
  logoUrl: z.string().max(500).nullable().default(null),
  // Falls back to the logo when empty.
  faviconUrl: z.string().max(500).nullable().default(null),
  // Brand colour anchored at the 500 stop; the full 50–950 ramp is derived
  // (buildColorRamp). null = keep each template's own palette.
  primaryColor: HexColorSchema.nullable().default(null),
  // null = keep the default (Cairo).
  fontId: z.enum(BRAND_FONT_IDS).nullable().default(null)
})
export type Brand = z.infer<typeof BrandSchema>
export const DEFAULT_BRAND: Brand = { logoUrl: null, faviconUrl: null, primaryColor: null, fontId: null }

export const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

// 11-stop ramp with `hex` as the 500 stop: lighter stops mix toward white,
// darker toward black. Deterministic and dependency-free so the admin preview
// and the storefront render identical colours.
export function buildColorRamp(hex: string): Record<(typeof RAMP_STOPS)[number], string> {
  const base = hexToRgb(hex)
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [0, 0, 0]
  return {
    50: mix(base, white, 0.94),
    100: mix(base, white, 0.86),
    200: mix(base, white, 0.72),
    300: mix(base, white, 0.52),
    400: mix(base, white, 0.26),
    500: rgbToHex(...base),
    600: mix(base, black, 0.14),
    700: mix(base, black, 0.3),
    800: mix(base, black, 0.46),
    900: mix(base, black, 0.62),
    950: mix(base, black, 0.78)
  }
}

// WCAG contrast ratio of white text on `hex` — the admin warns below 4.5.
export function contrastWithWhite(hex: string): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return 1.05 / (l + 0.05)
}

// Admin dashboard colour tokens (apps/admin leezil.css: --teal sidebar/buttons,
// --pine darkest text, --sage/--sage-light/--mist supporting tints, --text-2
// secondary text) derived from the brand colour. --teal carries white text, so
// the brand colour is darkened until it reaches 4.5:1 against white.
export function deriveAdminTheme(hex: string): Record<'teal' | 'pine' | 'sage' | 'sageLight' | 'mist' | 'text2' | 'okBg', string> {
  const ramp = buildColorRamp(hex)
  const teal = [hex, ramp[600], ramp[700], ramp[800], ramp[900]].find((c) => contrastWithWhite(c) >= 4.5) ?? ramp[900]
  const t = hexToRgb(teal)
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [0, 0, 0]
  return {
    teal,
    pine: mix(t, black, 0.42),
    sage: mix(t, white, 0.33),
    sageLight: mix(t, white, 0.6),
    mist: mix(t, white, 0.86),
    text2: mix(t, white, 0.25),
    okBg: mix(t, white, 0.9)
  }
}

// What POST admin/settings/brand/analyze-logo returns.
export const LogoAnalysisSchema = z.object({
  // Dominant brand colours, most prominent first (hex).
  palette: z.array(HexColorSchema),
  primaryColor: HexColorSchema.nullable(),
  // null when AI isn't configured or couldn't decide.
  fontId: z.enum(BRAND_FONT_IDS).nullable(),
  fontReason: z.string().nullable(),
  aiUsed: z.boolean()
})
export type LogoAnalysis = z.infer<typeof LogoAnalysisSchema>

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
  abandonedCartDelaySeconds: z.number().int().min(10).max(3600).default(60),
  // Brand identity (colour / font / logos). Edited via its own endpoint
  // (PUT admin/settings/brand) so the settings form can't wipe it.
  brand: BrandSchema.nullable().optional()
})
export type StoreSettings = z.infer<typeof StoreSettingsSchema>

export type LeadFormField = NonNullable<StoreSettings['leadFormConfig']>[0]

// Default lead form fields (used when leadFormConfig is null). wilaya/commune
// are 'select' — LeadFormFields.vue special-cases these two core keys to
// render cascading dropdowns backed by GET /wilayas + GET /communes?wilayaId=
// (real Algeria data) instead of the generic admin-typed `options` list.
export const DEFAULT_LEAD_FORM_FIELDS: LeadFormField[] = [
  // required: false — the full name is asked for but not gating checkout;
  // call-center confirmation collects/corrects it by phone anyway, and
  // dropping this requirement removes one avoidable field-validation stop
  // between "ready to buy" and a placed order. Admins can still make it
  // required again per-store from the lead form field builder.
  { id: 'name', key: 'name', label: 'Full name', type: 'text', placeholder: 'Your name', required: false, enabled: true, isCore: true },
  { id: 'phone', key: 'phone', label: 'Phone', type: 'tel', placeholder: '+213...', required: true, enabled: true, isCore: true },
  { id: 'wilaya', key: 'wilaya', label: 'Wilaya', type: 'select', placeholder: 'Select wilaya', required: true, enabled: true, isCore: true, halfWidth: true },
  { id: 'commune', key: 'commune', label: 'Commune', type: 'select', placeholder: 'Select commune', required: true, enabled: true, isCore: true, halfWidth: true }
]

// Admin update payload — same fields, all editable.
export const UpdateStoreSettingsSchema = StoreSettingsSchema
export type UpdateStoreSettings = z.infer<typeof UpdateStoreSettingsSchema>
