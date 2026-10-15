import { toast } from 'vue-sonner'

// Row selection for a table: a header "select all" checkbox (with the
// indeterminate state) plus per-row checkboxes. Ids that disappear from the table
// (filtered out, deleted, page changed) drop out of the selection by themselves.
export function useBulkSelect(rows: Ref<readonly { id: string }[]> | ComputedRef<readonly { id: string }[]>) {
  const selected = ref<Set<string>>(new Set())
  const ids = computed(() => rows.value.map((r) => r.id))
  const allChecked = computed(() => ids.value.length > 0 && ids.value.every((id) => selected.value.has(id)))
  const someChecked = computed(() => ids.value.some((id) => selected.value.has(id)))
  const indeterminate = computed(() => someChecked.value && !allChecked.value)

  watch(ids, (now) => {
    const keep = new Set(now)
    const next = new Set([...selected.value].filter((id) => keep.has(id)))
    if (next.size !== selected.value.size) selected.value = next
  })

  function toggleAll(on: boolean) {
    selected.value = on ? new Set(ids.value) : new Set()
  }
  function toggle(id: string, on: boolean) {
    const next = new Set(selected.value)
    if (on) next.add(id)
    else next.delete(id)
    selected.value = next
  }
  function clear() {
    selected.value = new Set()
  }
  return { selected, allChecked, indeterminate, toggleAll, toggle, clear, count: computed(() => selected.value.size) }
}

// Permanently deletes the selected rows one by one (SuperAdmin only, behind a typed
// confirmation) and reports what was deleted and what the server refused, with the
// server's own reason (e.g. a product that appears in orders).
export function useBulkDelete() {
  const { confirmDelete } = useDangerDelete()
  const busy = ref(false)

  async function bulkDelete(idsToDelete: string[], opts: { noun: string; warn?: string; remove: (id: string) => Promise<unknown> }): Promise<string[]> {
    if (!idsToDelete.length) return []
    const plural = idsToDelete.length === 1 ? opts.noun : `${opts.noun}s`
    if (!confirmDelete(`Permanently delete ${idsToDelete.length} ${plural}?${opts.warn ? ` ${opts.warn}` : ''}`)) return []
    busy.value = true
    const deleted: string[] = []
    const failed: string[] = []
    for (const id of idsToDelete) {
      try {
        await opts.remove(id)
        deleted.push(id)
      } catch (err) {
        const data = (err as { data?: { message?: string | string[] } })?.data
        failed.push(Array.isArray(data?.message) ? data!.message.join(' ') : (data?.message ?? 'Could not delete'))
      }
    }
    busy.value = false
    if (deleted.length) toast.success(`${deleted.length} ${deleted.length === 1 ? opts.noun : `${opts.noun}s`} deleted`)
    if (failed.length) toast.error(`${failed.length} could not be deleted`, { description: failed[0], duration: 12000 })
    return deleted
  }
  return { bulkDelete, busy }
}
