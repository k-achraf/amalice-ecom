import type { StockDetails, StockMovementsResponse } from '@amalice/shared'

// The one place the per-product "Stock details" endpoints live.
export function useStockDetailsApi() {
  const api = useAdminApi()
  const base = (productId: string) => `/admin/inventory/products/${productId}`
  return {
    details: (productId: string) => api<StockDetails>(`${base(productId)}/details`),
    movements: (productId: string, query: { page: number; pageSize: number; variantId?: string; reason?: string }) =>
      api<StockMovementsResponse>(`${base(productId)}/movements`, { query })
  }
}
