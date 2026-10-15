import { z } from 'zod'

// ---- Delivery details: every order sent to a shipping company ----

export const DELIVERY_STAGES = ['all', 'awaiting', 'withCourier', 'out', 'failed', 'delivered', 'returned'] as const
export const DeliveryStageSchema = z.enum(DELIVERY_STAGES)
export type DeliveryStage = z.infer<typeof DeliveryStageSchema>

export const DELIVERY_STAGE_LABELS: Record<DeliveryStage, string> = {
  all: 'All',
  awaiting: 'Awaiting confirmation',
  withCourier: 'With the courier',
  out: 'Out for delivery',
  failed: 'Delivery failed',
  delivered: 'Delivered',
  returned: 'Returned / cancelled'
}

export interface DeliveryRemark {
  at: string
  // 'attempt' = a delivery-attempt entry, 'remark' = a remark written by the driver or by us
  kind: 'attempt' | 'remark'
  text: string
  by: string | null
  station: string | null
}

export interface DeliveryListItem {
  shipmentId: string
  orderId: string
  orderState: string
  orderCreatedAt: string
  dispatchedAt: string
  codCents: number
  shippingType: 'Home' | 'Desk' | null
  customer: { name: string | null; phone: string }
  address: { region: string; city: string; line1: string }
  items: { name: string; quantity: number; variantLabel: string | null; imageUrl: string | null }[]
  courier: { name: string; companyId: string | null }
  // 'api' = created through the courier's API, 'manual' = recorded by hand / own driver.
  via: 'api' | 'manual'
  trackingReference: string | null
  courierStatusCode: string | null
  courierStatusLabel: string | null
  confirmed: boolean
  confirmedAt: string | null
  driverName: string | null
  driverPhone: string | null
  desk: { phone: string | null; commune: string | null; address: string | null; mapLink: string | null } | null
  lastFailureReason: string | null
  postponedTo: string | null
  carrierFeeCents: number | null
  returnFeeCents: number | null
  lastSyncedAt: string | null
  // Newest first, at most 5.
  remarks: DeliveryRemark[]
}

export interface DeliveryListResponse {
  items: DeliveryListItem[]
  total: number
  page: number
  pageSize: number
  counts: Record<DeliveryStage, number>
}
