import { toast } from 'vue-sonner'

// "Confirm return received": restock first (moves ReturnedToOrigin -> Restocked
// and puts the units back in stock), then best-effort courier-side validation
// for the restocked ids only. A validation failure never blocks or undoes the
// restock; it only shows a muted warning.
export function useConfirmReturns() {
  const api = useAdminApi()
  const { run } = useApiAction()
  const confirming = ref(false)

  async function confirmReturns(orderIds: string[]): Promise<string[]> {
    if (!orderIds.length) return []
    confirming.value = true
    try {
      const res = await run(
        () => api<{ restocked: string[]; skipped: { id: string; reason: string }[] }>('/admin/orders/restock-returns', { method: 'POST', body: { orderIds } }),
        { errorFallback: 'Could not confirm the returns' }
      )
      if (!res) return []
      if (res.restocked.length) {
        toast.success(`${res.restocked.length} return${res.restocked.length === 1 ? '' : 's'} received, stock updated`)
        try {
          await api('/admin/fulfillment/orders/validate-returns', { method: 'POST', body: { orderIds: res.restocked } })
        } catch {
          toast.warning('Stock was updated, but the courier could not validate the return on their side.')
        }
      }
      for (const s of res.skipped) toast.warning(`#${s.id.slice(0, 8)} skipped: ${s.reason}`)
      return res.restocked
    } finally {
      confirming.value = false
    }
  }

  return { confirmReturns, confirming }
}
