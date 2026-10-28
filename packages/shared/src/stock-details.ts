import type { OrderState } from './order'

// Where the units of ONE product are right now, by what has become of the orders that contain it.
// Cancelled orders (Cancelled, CancelledShipping) and abandoned carts are never counted as demand.
export const STOCK_BUCKETS = ['unconfirmed', 'confirmed', 'withCourier', 'delivered', 'returning', 'restocked'] as const
export type StockBucketKey = (typeof STOCK_BUCKETS)[number]

export const STOCK_BUCKET_LABELS: Record<StockBucketKey, string> = {
  unconfirmed: 'Not confirmed yet',
  confirmed: 'Confirmed, not shipped',
  withCourier: 'With the courier',
  delivered: 'Delivered',
  returning: 'Returning, not received',
  restocked: 'Returned and restocked'
}

// Which order states make up each bucket.
export const STOCK_BUCKET_STATES: Record<StockBucketKey, readonly OrderState[]> = {
  // Call-center queue: the customer has not said yes yet (no stock is taken). Archived ones are left out.
  unconfirmed: ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed'],
  // Confirmed (stock already taken) but still in our hands.
  confirmed: ['Confirmed', 'OnHold', 'Packed'],
  // Handed to a courier, on its way or being attempted.
  withCourier: ['HandedToCourier', 'OutForDelivery', 'DeliveryFailed'],
  delivered: ['Delivered', 'CashCollected', 'Reconciled', 'Settled'],
  // Coming back (or back at the courier) but nobody has confirmed receiving the parcel yet.
  returning: ['ReturnedToOrigin'],
  // Received back and counted: the units are in stock again.
  restocked: ['Restocked']
}

export interface StockBucketState {
  state: OrderState
  orders: number
  units: number
}
export interface StockBucket {
  orders: number
  units: number
  byState: StockBucketState[]
}

export interface StockDetailsRow {
  // null = the product itself (a product without variants), else one variant.
  variantId: string | null
  label: string
  sku: string | null
  onHand: number
  lowStockThreshold: number
  buckets: Record<StockBucketKey, { orders: number; units: number }>
  // Units of unconfirmed/confirmed orders that currently hold stock (already deducted from onHand).
  reservedUnits: number
  // onHand + reservedUnits: what is physically on our shelves.
  physicalInWarehouse: number
}

// GET admin/inventory/products/:id/details
export interface StockDetails {
  product: { id: string; name: string; imageUrl: string | null; sku: string | null; lowStockThreshold: number; hasVariants: boolean }
  // Recorded stock (sum of variants when the product has variants).
  onHand: number
  reservedUnits: number
  physicalInWarehouse: number
  buckets: Record<StockBucketKey, StockBucket>
  // Abandoned carts that contain the product: not orders, shown for information only.
  abandoned: { orders: number; units: number }
  // One row per variant (or a single row for a product without variants).
  rows: StockDetailsRow[]
  generatedAt: string
}

// GET admin/inventory/products/:id/movements?page=&pageSize=&variantId=&reason=
export interface StockMovementItem {
  id: string
  createdAt: string
  delta: number
  reason: string
  note: string | null
  variantId: string | null
  variantLabel: string | null
  orderId: string | null
  actorEmail: string | null
  supplierName: string | null
}
export interface StockMovementsResponse {
  items: StockMovementItem[]
  total: number
  page: number
  pageSize: number
}
