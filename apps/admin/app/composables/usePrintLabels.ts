// Several parcels' courier labels merged into one PDF by the API, then sent to
// the browser's print dialog. Selection state lives here so every queue that
// lists parcels (fulfillment, shipping) behaves the same.
export function usePrintLabels() {
  const api = useAdminApi()
  const { run } = useApiAction()
  const labelSelected = ref<Set<string>>(new Set())
  const printing = ref(false)

  function toggleLabel(id: string) {
    const next = new Set(labelSelected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    labelSelected.value = next
  }
  function toggleAllLabels(ids: string[]) {
    labelSelected.value = ids.length && ids.every((id) => labelSelected.value.has(id)) ? new Set() : new Set(ids)
  }

  async function printLabels(ids?: string[]) {
    const orderIds = ids ?? [...labelSelected.value]
    if (!orderIds.length) return
    printing.value = true
    const blob = await run(() => api<Blob>('/admin/fulfillment/orders/labels', { method: 'POST', body: { orderIds }, responseType: 'blob' }), {
      errorFallback: 'Could not build the labels PDF'
    })
    printing.value = false
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden'
    frame.src = url
    frame.onload = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        window.open(url, '_blank')
      }
      setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 60_000)
    }
    document.body.appendChild(frame)
  }

  return { labelSelected, printing, toggleLabel, toggleAllLabels, printLabels }
}
