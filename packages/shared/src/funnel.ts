import { z } from 'zod'
import { LandingSettingsSchema } from './funnel-landing'

// Product funnels — an ordered path a visitor walks (landing → order form →
// upsell → thank-you). This slice is admin-only: funnels are defined, stored
// and edited here; the storefront does not render them yet. Templates are the
// starting layouts offered when creating a funnel — a static catalog kept in
// code (not a table) so adding one is a code change that ships with the
// storefront renderer that understands it.

export const FunnelStatusSchema = z.enum(['Draft', 'Live', 'Paused'])
export type FunnelStatus = z.infer<typeof FunnelStatusSchema>

export const FunnelStepTypeSchema = z.enum(['Landing', 'OrderForm', 'OrderBump', 'Upsell', 'Downsell', 'ThankYou'])
export type FunnelStepType = z.infer<typeof FunnelStepTypeSchema>

export const FUNNEL_STEP_TYPE_META: Record<FunnelStepType, { label: string; description: string; icon: string }> = {
  Landing: { label: 'Landing page', description: 'Sales page that introduces the product and drives to the order form.', icon: 'i-lucide-image' },
  OrderForm: { label: 'Order form', description: 'Phone, address and quantity. Creates the cash-on-delivery order.', icon: 'i-lucide-clipboard-list' },
  OrderBump: { label: 'Order bump', description: 'A tick-box add-on shown inside the order form.', icon: 'i-lucide-plus-circle' },
  Upsell: { label: 'Upsell', description: 'One-click offer shown right after the order is placed.', icon: 'i-lucide-trending-up' },
  Downsell: { label: 'Downsell', description: 'A cheaper alternative offered when the upsell is declined.', icon: 'i-lucide-trending-down' },
  ThankYou: { label: 'Thank you', description: 'Order confirmation with the reference and what happens next.', icon: 'i-lucide-circle-check' }
}

export const FUNNEL_TEMPLATE_IDS = ['classic-cod', 'quick-order', 'upsell-booster', 'value-ladder'] as const
export const FunnelTemplateIdSchema = z.enum(FUNNEL_TEMPLATE_IDS)
export type FunnelTemplateId = z.infer<typeof FunnelTemplateIdSchema>

export interface FunnelTemplate {
  id: FunnelTemplateId
  name: string
  description: string
  bestFor: string
  steps: { type: FunnelStepType; name: string }[]
}

export const FUNNEL_TEMPLATES: FunnelTemplate[] = [
  {
    id: 'classic-cod',
    name: 'Classic COD',
    description: 'A sales page, the order form, then confirmation. The simplest complete path.',
    bestFor: 'Single products sold from social ads',
    steps: [
      { type: 'Landing', name: 'Sales page' },
      { type: 'OrderForm', name: 'Order form' },
      { type: 'ThankYou', name: 'Thank you' }
    ]
  },
  {
    id: 'quick-order',
    name: 'Quick order',
    description: 'Skips the sales page: visitors land straight on the order form.',
    bestFor: 'Warm traffic, repeat buyers and retargeting',
    steps: [
      { type: 'OrderForm', name: 'Order form' },
      { type: 'ThankYou', name: 'Thank you' }
    ]
  },
  {
    id: 'upsell-booster',
    name: 'Upsell booster',
    description: 'Classic path plus a one-click upsell right after the order is placed.',
    bestFor: 'Products with an obvious companion item',
    steps: [
      { type: 'Landing', name: 'Sales page' },
      { type: 'OrderForm', name: 'Order form' },
      { type: 'Upsell', name: 'Upsell offer' },
      { type: 'ThankYou', name: 'Thank you' }
    ]
  },
  {
    id: 'value-ladder',
    name: 'Value ladder',
    description: 'Order bump, upsell and a fallback downsell to lift the value of every order.',
    bestFor: 'Higher-priced products and bundles',
    steps: [
      { type: 'Landing', name: 'Sales page' },
      { type: 'OrderForm', name: 'Order form' },
      { type: 'OrderBump', name: 'Order bump' },
      { type: 'Upsell', name: 'Upsell offer' },
      { type: 'Downsell', name: 'Downsell offer' },
      { type: 'ThankYou', name: 'Thank you' }
    ]
  }
]

export function getFunnelTemplate(id: string): FunnelTemplate | undefined {
  return FUNNEL_TEMPLATES.find((t) => t.id === id)
}

// Offer-type steps (Upsell / Downsell / OrderBump) point at a product, with an
// optional special price. Other step types leave these null.
export const FunnelStepConfigSchema = z.object({
  offerProductId: z.uuid().nullable().optional(),
  priceCentsOverride: z.number().int().nonnegative().nullable().optional(),
  headline: z.string().trim().max(140).nullable().optional(),
  // Landing steps only: template, copy, accent and sections (see funnel-landing.ts).
  landing: LandingSettingsSchema.nullable().optional()
})
export type FunnelStepConfig = z.infer<typeof FunnelStepConfigSchema>

export const FunnelStepViewSchema = z.object({
  id: z.uuid(),
  funnelId: z.uuid(),
  position: z.number().int().nonnegative(),
  type: FunnelStepTypeSchema,
  name: z.string(),
  enabled: z.boolean(),
  config: FunnelStepConfigSchema,
  offerProduct: z.object({ id: z.uuid(), name: z.string(), imageUrl: z.string().nullable(), priceCents: z.number().int() }).nullable()
})
export type FunnelStepView = z.infer<typeof FunnelStepViewSchema>

const FunnelProductRefSchema = z.object({ id: z.uuid(), name: z.string(), slug: z.string(), imageUrl: z.string().nullable() })

export const FunnelListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: FunnelStatusSchema,
  templateId: z.string(),
  product: FunnelProductRefSchema,
  stepCount: z.number().int().nonnegative(),
  // Per-funnel pixel overrides (null = the store-wide pixel).
  metaPixelId: z.string().nullable(),
  tiktokPixelCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type FunnelListItem = z.infer<typeof FunnelListItemSchema>

export const FunnelDetailSchema = FunnelListItemSchema.extend({ steps: z.array(FunnelStepViewSchema) })
export type FunnelDetail = z.infer<typeof FunnelDetailSchema>

const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only')

export const CreateFunnelSchema = z.object({
  name: z.string().trim().min(1).max(100),
  productId: z.uuid(),
  templateId: FunnelTemplateIdSchema,
  slug: SlugSchema.optional()
})
export type CreateFunnel = z.infer<typeof CreateFunnelSchema>

export const UpdateFunnelSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  productId: z.uuid().optional(),
  status: FunnelStatusSchema.optional(),
  slug: SlugSchema.optional(),
  // Empty string / null clears the override.
  metaPixelId: z.union([z.string().trim().regex(/^[0-9]{5,20}$/, 'Meta pixel id is 5-20 digits'), z.literal('').transform(() => null), z.null()]).optional(),
  tiktokPixelCode: z.union([z.string().trim().regex(/^[A-Za-z0-9]{6,40}$/, 'TikTok pixel code is 6-40 letters/digits'), z.literal('').transform(() => null), z.null()]).optional()
})
export type UpdateFunnel = z.infer<typeof UpdateFunnelSchema>

export const CreateFunnelStepSchema = z.object({
  type: FunnelStepTypeSchema,
  name: z.string().trim().min(1).max(100).optional()
})
export type CreateFunnelStep = z.infer<typeof CreateFunnelStepSchema>

export const UpdateFunnelStepSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  config: FunnelStepConfigSchema.optional()
})
export type UpdateFunnelStep = z.infer<typeof UpdateFunnelStepSchema>

export const ReorderFunnelStepsSchema = z.object({ stepIds: z.array(z.uuid()).min(1) })
export type ReorderFunnelSteps = z.infer<typeof ReorderFunnelStepsSchema>

// ---- AI funnel generator --------------------------------------------------
// One click from a product: the AI picks the workflow (template), the landing
// layout, every landing setting and the copy, and which catalogue products to
// offer as bump/upsell/downsell. The result is a normal Draft funnel the admin
// can still edit. Copy language applies to the AI-written texts only; the
// fixed form/button labels of funnel pages stay as FUNNEL_COPY_AR.
export const FUNNEL_AI_LANGUAGES = ['ar', 'fr'] as const
export const GenerateFunnelSchema = z.object({
  productId: z.uuid(),
  language: z.enum(FUNNEL_AI_LANGUAGES).default('ar'),
  // Free-text steer, e.g. "target women 25-40, premium tone".
  instructions: z.string().trim().max(600).optional()
})
export type GenerateFunnel = z.infer<typeof GenerateFunnelSchema>

export interface GeneratedFunnelResult {
  funnel: FunnelDetail
  // Why the AI chose what it chose, shown to the admin after generation.
  plan: {
    workflowReason: string
    templateReason: string
    offers: { stepType: 'OrderBump' | 'Upsell' | 'Downsell'; productName: string; discountPercent: number }[]
    notes: string[]
  }
}
