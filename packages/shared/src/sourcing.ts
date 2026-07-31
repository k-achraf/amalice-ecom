import { z } from 'zod'

// Product sourcing / ad-testing operations — the pipeline a product goes
// through BEFORE it's a real storefront Product: found → tested with ads
// (multiple price/creative combinations) → if the numbers are good,
// requested from a wholesaler → once stock arrives, linked to a real
// Product and sold. See the Prisma schema's own comment on SourcedProduct
// for the full rationale on why this is a separate model tree rather than
// draft fields on Product.

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

// ---- Wholesalers ----

export const CreateWholesalerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().max(100).nullable().optional(),
  contactName: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
})
export type CreateWholesaler = z.infer<typeof CreateWholesalerSchema>

export const UpdateWholesalerSchema = CreateWholesalerSchema.partial()
export type UpdateWholesaler = z.infer<typeof UpdateWholesalerSchema>

export interface WholesalerView {
  id: string
  name: string
  country: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  website: string | null
  notes: string | null
  // How many sourcing requests reference this wholesaler — shown in the
  // list so an admin knows before deleting one whether it's actually in use.
  requestCount: number
  createdAt: string
  updatedAt: string
}

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
  createdAt: string
  updatedAt: string
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
  wholesalerId: z.uuid(),
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
  wholesaler: { id: string; name: string }
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
