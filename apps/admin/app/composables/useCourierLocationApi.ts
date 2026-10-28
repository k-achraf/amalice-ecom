import type { CourierCommuneOption, OrderCourierLocation, SetOrderCourierLocation } from '@amalice/shared'

// The one place the "Convert location" endpoints live (order <-> courier wilaya/commune).
export function useCourierLocationApi() {
  const api = useAdminApi()
  const base = (orderId: string) => `/admin/fulfillment/orders/${orderId}/courier-location`
  return {
    get: (orderId: string) => api<OrderCourierLocation>(base(orderId)),
    save: (orderId: string, body: SetOrderCourierLocation) => api<unknown>(base(orderId), { method: 'POST', body }),
    clear: (orderId: string) => api<unknown>(base(orderId), { method: 'DELETE' }),
    communes: (companyId: string, wilayaId: string) =>
      api<CourierCommuneOption[]>(`/admin/shipping-companies/${companyId}/courier-communes`, { query: { wilayaId } })
  }
}
