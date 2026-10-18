import { z } from 'zod'
import { CheckoutTrackingSchema } from './apps'
import { OrderSubmitGuardFields } from './order'
import { PhoneSchema } from './phone'
import { ShippingTypeSchema } from './shipping'
import type { FunnelStepType } from './funnel'
import type { LandingSettings } from './funnel-landing'
import type { ProductFaq, ProductSpecification } from './product'
import type { ProductOfferType } from './offer'
import type { Brand } from './store-settings'

// The public face of a funnel — what the standalone funnels site (apps/funnels)
// reads from GET /public/funnels/:slug, and what it posts back. Everything a
// visitor's page needs comes in this single payload so the site can render the
// whole page (and every later step) from one cached fetch.

export interface PublicFunnelOffer {
  id: string
  type: ProductOfferType
  requiredQuantity: number
  freeQuantity: number
  bundlePriceCents: number | null
}

export interface PublicFunnelVariant {
  id: string
  label: string
  priceCents: number
  stockQuantity: number
}

export interface PublicFunnelProduct {
  id: string
  slug: string
  name: string
  description: string | null
  priceCents: number
  stockQuantity: number
  lowStockThreshold: number
  imageUrl: string | null
  images: { url: string; altText: string | null }[]
  keyBenefits: string[]
  faqs: ProductFaq[]
  specifications: ProductSpecification[]
  // Enabled offers only.
  offers: PublicFunnelOffer[]
  requireOfferSelection: boolean
  variants: PublicFunnelVariant[]
}

export interface PublicFunnelStep {
  id: string
  type: FunnelStepType
  name: string
  headline: string | null
  // Upsell / Downsell / OrderBump: the product on offer and the price it is offered at.
  offerProduct: { id: string; name: string; imageUrl: string | null; priceCents: number; normalPriceCents: number } | null
}

// A real, approved customer review (first name only: never a full name).
export interface PublicFunnelReview {
  rating: number
  text: string
  author: string
}

export interface PublicFunnelWilaya {
  id: string
  name: string
  // null = that delivery type is not available in this wilaya.
  homePriceCents: number | null
  deskPriceCents: number | null
}

export interface PublicFunnel {
  id: string
  slug: string
  name: string
  storeName: string
  // Brand identity (logo / colour / font) from Settings → Brand; null = funnel's own accent and system font.
  brand: Brand | null
  product: PublicFunnelProduct
  // Real approved reviews (newest first, at most 6) and the overall average; empty / null when there are none.
  reviews: PublicFunnelReview[]
  rating: { avg: number; count: number } | null
  // Enabled steps only, in order.
  steps: PublicFunnelStep[]
  landing: LandingSettings
  // image-page template: the generated long image shown below the order form.
  generatedImageUrl: string | null
  pixels: { metaPixelId: string | null; tiktokPixelCode: string | null }
  abandonedDelaySeconds: number
  wilayas: PublicFunnelWilaya[]
}

// POST /public/funnels/:slug/orders — one request creates the order (and the order-bump line, if ticked).
// The server re-prices everything: nothing here is a price.
export const FunnelOrderSchema = z.object({
  fields: z.record(z.string(), z.string()),
  wilayaId: z.string(),
  shippingType: ShippingTypeSchema,
  variantId: z.uuid().optional(),
  offerId: z.uuid().optional(),
  quantity: z.number().int().positive().max(100).default(1),
  bumpStepId: z.uuid().optional(),
  tracking: CheckoutTrackingSchema.optional(),
  convertsAbandonedOrderId: z.uuid().optional(),
  ...OrderSubmitGuardFields
})
export type FunnelOrder = z.infer<typeof FunnelOrderSchema>

// POST /public/funnels/:slug/orders/:orderId/offers/:stepId — accept an upsell/downsell. The phone is the
// shared secret, same as order tracking.
export const AcceptFunnelOfferSchema = z.object({ phone: PhoneSchema })
export type AcceptFunnelOffer = z.infer<typeof AcceptFunnelOfferSchema>

export interface FunnelOrderResult {
  id: string
  totalCents: number
}

// ---- Customer-facing copy. The funnels site is Arabic / RTL like the storefront; the admin preview
// renders from the same dictionary so it shows exactly what visitors will read. ----

export const unitsLabel = (n: number) => (n === 1 ? 'قطعة واحدة' : n === 2 ? 'قطعتان' : n <= 10 ? `${n} قطع` : `${n} قطعة`)
export const formatDa = (cents: number) => `${(cents / 100).toLocaleString('en-US')} دج`

export const FUNNEL_COPY_AR = {
  dir: 'rtl' as const,
  lang: 'ar',
  defaultCta: 'اطلب الآن والدفع عند الاستلام',
  countdownDefault: 'ينتهي العرض خلال',
  defaultUrgency: 'الكمية محدودة: اطلب اليوم قبل نفاد المخزون',
  payOnDelivery: 'الدفع عند الاستلام',
  orderNow: 'اطلب الآن',
  payWhenArrives: 'ادفع عند وصول طلبك',
  chooseOffer: 'اختر عرضك',
  singleUnit: 'قطعة واحدة',
  singleItemNote: 'قطعة واحدة',
  bestValue: 'الأفضل قيمة',
  save: (amount: string) => `وفّر ${amount}`,
  lessPerUnit: 'أو أقل للقطعة مع العرض',
  buyX: (n: number) => `اشترِ ${n}`,
  buyXGetY: (x: number, y: number) => `اشترِ ${x} واحصل على ${y} مجاناً`,
  buyXFreeShipping: (n: number) => `اشترِ ${n} والتوصيل مجاني`,
  freeShippingNote: (u: string) => `${u} · توصيل مجاني`,
  variant: 'اختر النوع',
  fullName: 'الاسم الكامل',
  phone: 'رقم الهاتف',
  phoneHint: '05 / 06 / 07 …',
  wilaya: 'الولاية',
  commune: 'البلدية',
  chooseWilaya: 'اختر الولاية',
  chooseCommune: 'اختر البلدية',
  address: 'العنوان',
  optional: '(اختياري)',
  notes: 'ملاحظات (اختياري)',
  homeDelivery: 'التوصيل للمنزل',
  deskDelivery: 'التوصيل للمكتب',
  product: 'المنتج',
  delivery: 'التوصيل',
  deliveryByWilaya: 'حسب الولاية',
  free: 'مجاني',
  toPay: 'المبلغ عند الاستلام',
  bump: 'أضف إلى طلبك',
  trust: ['الدفع عند الاستلام', 'افحص قبل أن تدفع', 'إرجاع سهل'] as const,
  safeNote: 'سنتصل بك لتأكيد طلبك. لا يوجد دفع إلكتروني.',
  total: 'المجموع',
  onlyLeft: (n: number) => `بقيت ${n} قطع فقط`,
  outOfStock: 'نفدت الكمية',
  about: 'عن المنتج',
  why: 'لماذا ستحبه',
  specs: 'المواصفات',
  how: 'كيف تطلب',
  howSteps: ['املأ اسمك وهاتفك وعنوانك', 'نتصل بك لتأكيد الطلب', 'ادفع نقداً عند وصول الطلب'] as const,
  reviews: 'آراء الزبائن',
  questions: 'الأسئلة الشائعة',
  noteNoDescription: 'لا يوجد وصف بعد. أضفه من تبويب Details في المنتج.',
  noteNoBenefits: 'لا توجد مزايا بعد. أضفها من تبويب Content في المنتج.',
  noteNoSpecs: 'لا توجد مواصفات بعد. أضفها من تبويب Content في المنتج.',
  noteNoFaq: 'لا توجد أسئلة بعد. أضفها من تبويب Content في المنتج.',
  errName: 'أدخل اسمك',
  errPhone: 'رقم هاتف غير صحيح (مثال: 0555123456)',
  errWilaya: 'اختر الولاية',
  errCommune: 'اختر البلدية',
  errAddress: 'أدخل عنوانك',
  errDelivery: 'اختر طريقة التوصيل',
  errGeneric: 'حدث خطأ، حاول مرة أخرى',
  errNetwork: 'تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.',
  sending: 'جارٍ الإرسال…',
  thanksTitle: 'تم استلام طلبك!',
  thanksBody: (phone: string) => `سنتصل بك قريباً على الرقم ${phone} لتأكيد الطلب.`,
  orderNumber: 'رقم الطلب',
  thanksNext: 'ما الذي سيحدث الآن؟',
  thanksSteps: ['نتصل بك لتأكيد الطلب', 'نجهّز طلبك ونشحنه', 'تدفع نقداً عند الاستلام'] as const,
  offerKicker: 'عرض خاص لك فقط',
  offerAdd: 'نعم، أضفه إلى طلبي',
  offerSkip: 'لا شكراً',
  offerNote: 'يُضاف إلى طلبك نفسه ويُدفع عند الاستلام.',
  normalPrice: 'السعر العادي'
}
