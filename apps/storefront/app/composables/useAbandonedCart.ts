import { normalizeAlgerianPhone } from '@amalice/shared'

// Live abandoned-cart capture for the lead forms (see AbandonedLeadOrderSchema
// / OrdersService.createAbandonedOrder). As soon as the customer has typed a
// complete phone number the order is created as an abandoned cart; every later
// change to the form re-sends (debounced) and the API updates that SAME row.
// A real submit converts it via convertsAbandonedOrderId (`orderId` below).
//
// Calls are serialized: a change made while a request is in flight is sent
// right after it finishes, with the id the first one returned — otherwise two
// quick edits could each create their own row.
const COMPLETE_PHONE = /^\+213[567]\d{8}$/

export function isCompletePhone(raw: string | undefined | null): boolean {
  return !!raw && COMPLETE_PHONE.test(normalizeAlgerianPhone(raw))
}

export function useAbandonedCart(buildBody: () => Record<string, unknown> | null) {
  const apiClient = useApiClient()
  const orderId = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let sending = false
  let dirty = false
  let stopped = false

  async function send() {
    if (stopped) return
    if (sending) {
      dirty = true
      return
    }
    const body = buildBody()
    if (!body) return
    sending = true
    try {
      const saved = await apiClient<{ id: string }>('/orders/abandoned', {
        method: 'POST',
        body: { ...body, abandonedOrderId: orderId.value ?? undefined }
      })
      orderId.value = saved.id
    } catch {
      // Best-effort — a failed capture must never surface to the customer or
      // block them from completing checkout normally.
    } finally {
      sending = false
      if (dirty && !stopped) {
        dirty = false
        void send()
      }
    }
  }

  function schedule() {
    if (stopped) return
    clearTimeout(timer)
    timer = setTimeout(send, 800)
  }

  // Called on submit: no further captures once the real order is being placed.
  function stop() {
    stopped = true
    clearTimeout(timer)
  }

  onBeforeUnmount(stop)

  return { orderId, schedule, stop }
}
