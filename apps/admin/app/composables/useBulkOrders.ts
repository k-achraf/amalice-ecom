import type { BulkTransitionResult, OrderState } from '@amalice/shared'
import { toast } from 'vue-sonner'

// Row selection for a table of orders. One instance per table/section.
export function useBulkSelection() {
  const selected = ref<Set<string>>(new Set())
  const count = computed(() => selected.value.size)
  const has = (id: string) => selected.value.has(id)
  function toggle(id: string) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
  }
  // All of `ids` selected -> clear them; otherwise select all of them.
  function toggleAll(ids: string[]) {
    selected.value = ids.length > 0 && ids.every((id) => selected.value.has(id)) ? new Set() : new Set(ids)
  }
  const allOf = (ids: string[]) => ids.length > 0 && ids.every((id) => selected.value.has(id))
  const clear = () => { selected.value = new Set() }
  // Drop ids that are no longer in the list (after a refresh / filter change).
  function keepOnly(ids: string[]) {
    const keep = new Set(ids)
    const next = new Set([...selected.value].filter((id) => keep.has(id)))
    if (next.size !== selected.value.size) selected.value = next
  }
  return { selected, count, has, toggle, toggleAll, allOf, clear, keepOnly, ids: () => [...selected.value] }
}

// Move several orders to the same state (POST /admin/orders/bulk-transition). Each order is checked on
// its own by the server, so a few may fail while the rest move: the toast says how many and why.
export function useBulkTransition() {
  const api = useAdminApi()
  const busy = ref(false)

  async function bulkTransition(orderIds: string[], to: OrderState, label: string): Promise<BulkTransitionResult | null> {
    if (!orderIds.length) return null
    busy.value = true
    try {
      const res = await api<BulkTransitionResult>('/admin/orders/bulk-transition', { method: 'POST', body: { orderIds, to } })
      if (res.moved.length) toast.success(`${res.moved.length} order${res.moved.length > 1 ? 's' : ''}: ${label}`)
      if (res.failed.length) {
        const first = res.failed.slice(0, 3).map((f) => `#${f.id.slice(0, 8)}: ${f.reason}`).join(' · ')
        toast.error(`${res.failed.length} order${res.failed.length > 1 ? 's' : ''} could not be updated`, { description: first + (res.failed.length > 3 ? ' …' : '') })
      }
      return res
    } catch (error) {
      toast.error((error as { data?: { message?: string } })?.data?.message ?? 'Could not update the orders')
      return null
    } finally {
      busy.value = false
    }
  }
  return { bulkTransition, busy }
}
