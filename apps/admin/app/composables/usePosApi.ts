import type { PosOrder, PosOrderResult, PosProduct, PosRecentOrder } from '@amalice/shared'

// The one place the POS endpoints live.
export function usePosApi() {
  const api = useAdminApi()
  return {
    searchProducts: (search: string) => api<PosProduct[]>('/admin/pos/products', { query: { search } }),
    recent: () => api<PosRecentOrder[]>('/admin/pos/recent'),
    createOrder: (body: PosOrder) => api<PosOrderResult>('/admin/pos/orders', { method: 'POST', body })
  }
}
