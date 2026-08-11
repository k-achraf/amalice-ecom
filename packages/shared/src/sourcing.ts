import { z } from 'zod'

// Product sourcing / ad-testing operations — the pipeline a product goes
// through BEFORE it's a real storefront Product: found → tested with ads
// (multiple price/creative combinations) → if the numbers are good, stock is
// requested → once it arrives, linked to a real Product and sold. See the
// Prisma schema's own comment on SourcedProduct for the full rationale on
// why this is a separate model tree rather than draft fields on Product.
// (No supplier/wholesaler tracking here — that concept was removed; a
// sourcing request is just "we requested N units, here's the status.")

export const SourcedProductStatus = z.enum([
  'Researching',
  'Testing',
  'TestPassed',
  'TestFailed',
  'Sourcing',
  'Received',
  'Live',
  'Discontinued'
])
export type SourcedProductStatus = z.infer<typeof SourcedProductStatus>

// Not a strict state machine like OrderState — sourcing status is a manual
// operator call ("I've decided this test passed"), not something the
// system can validate transitions for. Every status is reachable from every
// other status; the UI just shows all of them as options.
export const SOURCED_PRODUCT_STATUSES = SourcedProductStatus.options

export const AdTestPlatform = z.enum(['Facebook', 'TikTok', 'Snapchat', 'Google', 'Other'])
export type AdTestPlatform = z.infer<typeof AdTestPlatform>

export const AdCreativeType = z.enum(['Image', 'Video'])
export type AdCreativeType = z.infer<typeof AdCreativeType>

export const AdTestStatus = z.enum(['Running', 'Passed', 'Failed'])
export type AdTestStatus = z.infer<typeof AdTestStatus>

export const SourcingRequestStatus = z.enum(['Requested', 'Confirmed', 'Shipped', 'Received', 'Cancelled'])
export type SourcingRequestStatus = z.infer<typeof SourcingRequestStatus>

// ---- Sourced products ----

export const CreateSourcedProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  niche: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: SourcedProductStatus.default('Researching')
})
export type CreateSourcedProduct = z.infer<typeof CreateSourcedProductSchema>

export const UpdateSourcedProductSchema = CreateSourcedProductSchema.partial()
export type UpdateSourcedProduct = z.infer<typeof UpdateSourcedProductSchema>

// Sets (or clears, with productId: null) which real catalog Product this
// candidate became once it went live.
export const LinkSourcedProductSchema = z.object({
  productId: z.uuid().nullable()
})
export type LinkSourcedProduct = z.infer<typeof LinkSourcedProductSchema>

export interface SourcedProductListItem {
  id: string
  name: string
  imageUrl: string | null
  niche: string | null
  status: SourcedProductStatus
  linkedProduct: { id: string; name: string; slug: string } | null
  adTestCount: number
  sourcingRequestCount: number
  createdAt: string
  updatedAt: string
}

export interface SourcedProductDetail {
  id: string
  name: string
  sourceUrl: string | null
  imageUrl: string | null
  niche: string | null
  notes: string | null
  status: SourcedProductStatus
  linkedProduct: { id: string; name: string; slug: string } | null
  adTests: ProductAdTestView[]
  sourcingRequests: ProductSourcingRequestView[]
  media: SourcedProductMediaView[]
  links: SourcedProductLinkView[]
  videoCreatives: SourcedProductVideoCreativeView[]
  competitors: SourcedProductCompetitorView[]
  createdAt: string
  updatedAt: string
}

// ---- Media (images/videos) ----

export const SourcedProductMediaType = z.enum(['Image', 'Video'])
export type SourcedProductMediaType = z.infer<typeof SourcedProductMediaType>

export const CreateSourcedProductMediaSchema = z.object({
  type: SourcedProductMediaType,
  url: z.string().trim().min(1).max(500),
  caption: z.string().trim().max(200).nullable().optional()
})
export type CreateSourcedProductMedia = z.infer<typeof CreateSourcedProductMediaSchema>

export const UpdateSourcedProductMediaSchema = z.object({
  caption: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().optional()
})
export type UpdateSourcedProductMedia = z.infer<typeof UpdateSourcedProductMediaSchema>

export interface SourcedProductMediaView {
  id: string
  sourcedProductId: string
  type: SourcedProductMediaType
  url: string
  caption: string | null
  sortOrder: number
  createdAt: string
}

// Bulk reorder — same "send the full ordered id list" pattern as
// products/:id/reorder-images.
export const ReorderSourcedProductMediaSchema = z.object({
  orderedIds: z.array(z.uuid())
})
export type ReorderSourcedProductMedia = z.infer<typeof ReorderSourcedProductMediaSchema>

// ---- Links (where this product is listed elsewhere) ----

export const CreateSourcedProductLinkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(500)
})
export type CreateSourcedProductLink = z.infer<typeof CreateSourcedProductLinkSchema>

export const UpdateSourcedProductLinkSchema = CreateSourcedProductLinkSchema.partial()
export type UpdateSourcedProductLink = z.infer<typeof UpdateSourcedProductLinkSchema>

export interface SourcedProductLinkView {
  id: string
  sourcedProductId: string
  label: string
  url: string
  createdAt: string
}

// ---- Video creatives ----
// A running collection of video ad-creatives worth keeping an eye on while
// researching/testing this product — yours or a competitor's. Distinct from
// ProductAdTest.creativeUrl below, which is tied to one specific
// price/spend experiment. The marketing-angle fields (angle/hook/
// description) mirror the columns a real ad-testing spreadsheet tracks per
// creative — see SourcedProductVideoCreative's Prisma comment.

export const VideoCreativeStatus = z.enum(['Idea', 'Testing', 'Winner', 'Killed'])
export type VideoCreativeStatus = z.infer<typeof VideoCreativeStatus>

export const CreateSourcedProductVideoCreativeSchema = z.object({
  url: z.string().trim().min(1).max(500),
  platform: AdTestPlatform.nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
  // The marketing angle this creative is built around (e.g. "Pain point",
  // "Before/after", "Social proof", "Urgency/FOMO") — free text, not an
  // enum; angles are ad-buyer vocabulary, not a fixed taxonomy.
  angle: z.string().trim().max(200).nullable().optional(),
  // The opening line/visual — what stops the scroll in the first 1-3
  // seconds.
  hook: z.string().trim().max(500).nullable().optional(),
  // What the creative actually shows/says beyond the hook — a short script
  // summary or shot list, not the full script verbatim.
  description: z.string().trim().max(2000).nullable().optional(),
  status: VideoCreativeStatus.default('Idea'),
  notes: z.string().trim().max(500).nullable().optional()
})
export type CreateSourcedProductVideoCreative = z.infer<typeof CreateSourcedProductVideoCreativeSchema>

export const UpdateSourcedProductVideoCreativeSchema = CreateSourcedProductVideoCreativeSchema.partial()
export type UpdateSourcedProductVideoCreative = z.infer<typeof UpdateSourcedProductVideoCreativeSchema>

export interface SourcedProductVideoCreativeView {
  id: string
  sourcedProductId: string
  url: string
  platform: AdTestPlatform | null
  name: string | null
  angle: string | null
  hook: string | null
  description: string | null
  status: VideoCreativeStatus
  notes: string | null
  createdAt: string
}

// ---- Competitors ----
// Who else is selling this product, at what price, and any other detail
// worth noting — research scratch space, not a structured competitor-intel
// system, hence the free-text `details` field.

export const CreateSourcedProductCompetitorSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  url: z.string().trim().min(1).max(500),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  details: z.string().trim().max(2000).nullable().optional()
})
export type CreateSourcedProductCompetitor = z.infer<typeof CreateSourcedProductCompetitorSchema>

export const UpdateSourcedProductCompetitorSchema = CreateSourcedProductCompetitorSchema.partial()
export type UpdateSourcedProductCompetitor = z.infer<typeof UpdateSourcedProductCompetitorSchema>

export interface SourcedProductCompetitorView {
  id: string
  sourcedProductId: string
  name: string | null
  url: string
  priceCents: number | null
  details: string | null
  createdAt: string
}

// ---- Ad tests ----

export const CreateProductAdTestSchema = z.object({
  platform: AdTestPlatform.default('Other'),
  priceCents: z.number().int().nonnegative(),
  creativeType: AdCreativeType.nullable().optional(),
  creativeUrl: z.string().trim().max(500).nullable().optional(),
  adSpendCents: z.number().int().nonnegative().default(0),
  ordersCount: z.number().int().nonnegative().default(0),
  revenueCents: z.number().int().nonnegative().default(0),
  status: AdTestStatus.default('Running'),
  isWinner: z.boolean().default(false),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
})
export type CreateProductAdTest = z.infer<typeof CreateProductAdTestSchema>

export const UpdateProductAdTestSchema = CreateProductAdTestSchema.partial()
export type UpdateProductAdTest = z.infer<typeof UpdateProductAdTestSchema>

export interface ProductAdTestView {
  id: string
  sourcedProductId: string
  platform: AdTestPlatform
  priceCents: number
  creativeType: AdCreativeType | null
  creativeUrl: string | null
  adSpendCents: number
  ordersCount: number
  revenueCents: number
  status: AdTestStatus
  isWinner: boolean
  startedAt: string | null
  endedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Derived read-only metrics — computed from a test's own fields rather than
// stored, so they can never drift from the underlying numbers. Cost per
// acquisition is null (not Infinity/0) when there's nothing to divide by,
// so the UI can render "—" instead of a nonsense number.
export function adTestCpaCents(test: Pick<ProductAdTestView, 'adSpendCents' | 'ordersCount'>): number | null {
  if (test.ordersCount <= 0) return null
  return Math.round(test.adSpendCents / test.ordersCount)
}
export function adTestRoas(test: Pick<ProductAdTestView, 'adSpendCents' | 'revenueCents'>): number | null {
  if (test.adSpendCents <= 0) return null
  return test.revenueCents / test.adSpendCents
}

// ---- Sourcing requests ----

export const CreateProductSourcingRequestSchema = z.object({
  requestedQuantity: z.number().int().positive(),
  requestedCountry: z.string().trim().min(1).max(100),
  unitCostCents: z.number().int().nonnegative().nullable().optional(),
  status: SourcingRequestStatus.default('Requested'),
  notes: z.string().trim().max(2000).nullable().optional(),
  receivedAt: z.string().datetime().nullable().optional()
})
export type CreateProductSourcingRequest = z.infer<typeof CreateProductSourcingRequestSchema>

export const UpdateProductSourcingRequestSchema = CreateProductSourcingRequestSchema.partial()
export type UpdateProductSourcingRequest = z.infer<typeof UpdateProductSourcingRequestSchema>

export interface ProductSourcingRequestView {
  id: string
  sourcedProductId: string
  requestedQuantity: number
  requestedCountry: string
  unitCostCents: number | null
  status: SourcingRequestStatus
  notes: string | null
  requestedAt: string
  receivedAt: string | null
  createdAt: string
  updatedAt: string
}
