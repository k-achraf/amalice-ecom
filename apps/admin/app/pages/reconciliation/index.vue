<script setup lang="ts">
import type { LedgerEntry, RemittanceBatch, RemittanceBatchStatus } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'Finance'] })
useHead({ title: 'Reconciliation' })

const route = useRoute()
const router = useRouter()
const api = useAdminApi()
const { run } = useApiAction()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))

const { data: batches, pending } = await useAdminFetch<{ items: RemittanceBatch[]; total: number; pageSize: number }>(
  '/admin/reconciliation/batches',
  { key: 'admin-recon-batches', query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '20' } }
)

// Couriers only exist once at least one shipment has gone through them
// (FulfillmentService auto-upserts the row) — this powers the import
// modal's dropdown instead of making an admin hand-type a raw UUID they
// have no way to look up, which is what made "Import batch" effectively
// unusable before.
const { data: couriers } = await useAdminFetch<{ id: string; name: string }[]>('/admin/reconciliation/couriers', {
  key: 'admin-recon-couriers'
})

async function loadBatches() {
  batches.value = await api<{ items: RemittanceBatch[]; total: number; pageSize: number }>('/admin/reconciliation/batches', {
    query: { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  })
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await loadBatches()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await loadBatches()
}

const { data: discrepancies, refresh: refreshDiscrepancies } = await useAdminFetch<(LedgerEntry & { deltaCents?: number | null })[]>(
  '/admin/reconciliation/discrepancies',
  { key: 'admin-recon-discrepancies' }
)

const statusColor: Record<RemittanceBatchStatus, 'info' | 'success' | 'warning'> = {
  Imported: 'info',
  Matched: 'success',
  Discrepancy: 'warning',
  Settled: 'success'
}

const entryStatusColor: Record<LedgerEntry['status'], 'success' | 'error' | 'warning' | 'neutral'> = {
  Matched: 'success',
  Mismatch: 'error',
  Unmatched: 'warning',
  Resolved: 'neutral'
}

// ---- Batch entries drill-down ----
// Previously there was no way to actually see what's inside a batch (the
// admin/reconciliation/batches/:id/entries endpoint existed but nothing
// called it) — a batch row just sat there as a total with an Auto-match
// button and no visibility into what it matched, mismatched, or left
// untouched.
const entriesByBatch = reactive<Record<string, LedgerEntry[] | undefined>>({})
const loadingEntries = reactive<Record<string, boolean>>({})

async function toggleEntries(batchId: string) {
  if (entriesByBatch[batchId]) {
    entriesByBatch[batchId] = undefined
    return
  }
  loadingEntries[batchId] = true
  try {
    entriesByBatch[batchId] = await api<LedgerEntry[]>(`/admin/reconciliation/batches/${batchId}/entries`)
  } finally {
    loadingEntries[batchId] = false
  }
}

// ---- Import modal (FIN-02) ----
const showImport = ref(false)
const saving = ref(false)
const importRows = ref('')
const courierId = ref('')
const reference = ref('')
// Sensible default window (last 7 days) instead of forcing every import to
// start from two empty date pickers — a remittance batch is almost always
// "everything from the last week or two", not an arbitrary custom range.
const now = new Date()
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const periodStart = ref(toLocalInput(weekAgo))
const periodEnd = ref(toLocalInput(now))

// Parsed live as the admin types/pastes, so they see exactly what will be
// submitted (row count + any lines that don't parse) before hitting Import,
// instead of finding out only after a submit fails.
const parsedRows = computed(() => {
  const lines = importRows.value.split('\n').map((l) => l.trim()).filter(Boolean)
  const valid: { courierRef: string; collectedCents: number }[] = []
  const invalidCount = { value: 0 }
  for (const line of lines) {
    const [courierRef, amountStr] = line.split(',').map((s) => s?.trim())
    const amountDzd = Number(amountStr)
    if (!courierRef || !amountStr || !Number.isFinite(amountDzd) || amountDzd < 0) {
      invalidCount.value++
      continue
    }
    // Rows are entered in plain DZD (what a courier's own remittance report
    // shows, and what an admin actually reads off it) and converted to
    // cents here — every *Cents field elsewhere in this app follows the
    // same convention (see PriceDisplay/productPriceDzd). Storing the raw
    // typed number directly as "cents" was the previous behavior, and it
    // silently made every auto-match fail: a real 3,600 DZD collection was
    // recorded as 3,600 cents (36.00 DZD), which can never equal an order's
    // real totalCents.
    valid.push({ courierRef, collectedCents: Math.round(amountDzd * 100) })
  }
  return { valid, invalidCount: invalidCount.value }
})

const canImport = computed(() => !!courierId.value && !!reference.value.trim() && parsedRows.value.valid.length > 0 && new Date(periodStart.value) <= new Date(periodEnd.value))

function resetImportForm() {
  importRows.value = ''
  reference.value = ''
  courierId.value = ''
}

async function runImport() {
  if (!canImport.value) return
  saving.value = true
  const result = await run(
    () =>
      api('/admin/reconciliation/batches', {
        method: 'POST',
        body: {
          courierId: courierId.value,
          reference: reference.value.trim(),
          // datetime-local gives "2026-08-05T14:30" with no seconds/timezone
          // — not a valid ISO datetime string, which is what the backend's
          // Zod schema requires. Every import silently 400'd on this before
          // ever reaching the DB.
          periodStart: new Date(periodStart.value).toISOString(),
          periodEnd: new Date(periodEnd.value).toISOString(),
          rows: parsedRows.value.valid
        }
      }),
    { success: `Batch imported — ${parsedRows.value.valid.length} rows`, errorFallback: 'Could not import the batch' }
  )
  if (result !== undefined) {
    showImport.value = false
    resetImportForm()
  }
  await loadBatches()
  saving.value = false
}

async function runMatch(batchId: string) {
  const result = await run(() => api<{ matched: number; mismatched: number; unmatched: number }>(`/admin/reconciliation/batches/${batchId}/match`, { method: 'POST' }), {
    errorFallback: 'Could not auto-match the batch'
  })
  if (result) {
    const toast = useToast()
    toast.add({
      title: `Matched ${result.matched} · Mismatched ${result.mismatched} · Unmatched ${result.unmatched}`,
      color: result.mismatched || result.unmatched ? 'warning' : 'success'
    })
  }
  await loadBatches()
  await refreshDiscrepancies()
  if (entriesByBatch[batchId]) {
    entriesByBatch[batchId] = await api<LedgerEntry[]>(`/admin/reconciliation/batches/${batchId}/entries`)
  }
}

// Per-entry resolution notes, keyed by entry id — the old version used ONE
// shared ref for every row's input, so typing a note for one discrepancy
// silently appeared in every other row's box too, and clicking "Resolve" on
// the wrong row would apply someone else's note to it.
const resolveNotes = reactive<Record<string, string>>({})
const resolving = ref<string | null>(null)
async function resolve(entryId: string) {
  const note = resolveNotes[entryId]?.trim()
  if (!note) return
  resolving.value = entryId
  const result = await run(
    () => api(`/admin/reconciliation/entries/${entryId}/resolve`, { method: 'POST', body: { resolutionNote: note } }),
    { success: 'Discrepancy resolved', errorFallback: 'Could not resolve the discrepancy' }
  )
  if (result !== undefined) resolveNotes[entryId] = ''
  resolving.value = null
  await loadBatches()
  await refreshDiscrepancies()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Cash Reconciliation">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right><UButton icon="i-lucide-upload" size="sm" label="Import batch" @click="showImport = true" /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-8">
        <!-- Discrepancy queue (FIN-04) -->
        <section v-if="discrepancies?.length">
          <h2 class="mb-3 text-sm font-medium text-muted">Discrepancies (sorted by delta)</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-4 py-2.5 text-left">Courier ref</th>
                  <th class="px-4 py-2.5 text-right">Expected</th>
                  <th class="px-4 py-2.5 text-right">Collected</th>
                  <th class="px-4 py-2.5 text-right">Delta</th>
                  <th class="px-4 py-2.5 text-left">Resolve</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in discrepancies" :key="e.id">
                  <td class="tabular px-4 py-3">{{ e.courierRef }}</td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay v-if="e.expectedCents != null" :amount-cents="e.expectedCents" /><template v-else>—</template></td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="e.collectedCents" /></td>
                  <td class="tabular px-4 py-3 text-right" :class="e.deltaCents && e.deltaCents !== 0 ? 'text-error font-medium' : 'text-warning'">
                    <PriceDisplay v-if="e.deltaCents != null" :amount-cents="e.deltaCents" /><template v-else>unmatched</template>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <UInput v-model="resolveNotes[e.id]" placeholder="reason…" size="xs" class="w-40" @keyup.enter="resolve(e.id)" />
                      <UButton size="xs" :loading="resolving === e.id" :disabled="!resolveNotes[e.id]?.trim()" label="Resolve" @click="resolve(e.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <EmptyState
          v-else-if="!pending"
          icon="i-lucide-check-circle-2"
          title="No open discrepancies"
          description="Every matched batch's entries are either matched or already resolved."
        />

        <!-- Batches (FIN-01/03) -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Remittance batches</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="w-8 px-4 py-2.5"></th>
                  <th class="px-4 py-2.5 text-left">Reference</th>
                  <th class="px-4 py-2.5 text-left">Courier</th>
                  <th class="px-4 py-2.5 text-left">Period</th>
                  <th class="px-4 py-2.5 text-right">Total</th>
                  <th class="px-4 py-2.5 text-left">Status</th>
                  <th class="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pending"><td colspan="7" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-else-if="!batches?.items.length"><td colspan="7" class="px-4 py-12 text-center text-muted">No batches yet. Click "Import batch" to bring in a courier's remittance report.</td></tr>
                <template v-for="b in batches?.items" :key="b.id">
                  <tr class="cursor-pointer" @click="toggleEntries(b.id)">
                    <td class="px-4 py-3 text-muted">
                      <UIcon :name="entriesByBatch[b.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
                    </td>
                    <td class="px-4 py-3 font-medium">{{ b.reference }}</td>
                    <td class="px-4 py-3 text-muted">{{ b.courierName ?? '—' }}</td>
                    <td class="px-4 py-3 text-xs text-muted">{{ b.periodStart?.slice(0, 10) }} → {{ b.periodEnd?.slice(0, 10) }}</td>
                    <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="b.totalCents" /></td>
                    <td class="px-4 py-3"><UBadge :color="statusColor[b.status]" variant="subtle">{{ b.status }}</UBadge></td>
                    <td class="px-4 py-3 text-right" @click.stop>
                      <UButton
                        v-if="b.status === 'Imported' || b.status === 'Discrepancy'"
                        size="xs"
                        variant="soft"
                        color="primary"
                        label="Auto-match"
                        @click="runMatch(b.id)"
                      />
                    </td>
                  </tr>
                  <tr v-if="entriesByBatch[b.id] || loadingEntries[b.id]">
                    <td colspan="7" class="bg-[var(--color-admin-surface-tint)] px-4 py-3">
                      <p v-if="loadingEntries[b.id]" class="text-sm text-muted">Loading entries…</p>
                      <p v-else-if="!entriesByBatch[b.id]?.length" class="text-sm text-muted">This batch has no entries.</p>
                      <table v-else class="w-full text-xs">
                        <thead class="text-left uppercase tracking-wide text-muted">
                          <tr>
                            <th class="py-1.5 pe-3">Courier ref</th>
                            <th class="py-1.5 pe-3 text-right">Expected</th>
                            <th class="py-1.5 pe-3 text-right">Collected</th>
                            <th class="py-1.5 pe-3">Status</th>
                            <th class="py-1.5">Note</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--color-admin-border)]">
                          <tr v-for="entry in entriesByBatch[b.id]" :key="entry.id">
                            <td class="tabular py-1.5 pe-3">{{ entry.courierRef }}</td>
                            <td class="tabular py-1.5 pe-3 text-right"><PriceDisplay v-if="entry.expectedCents != null" :amount-cents="entry.expectedCents" /><span v-else class="text-muted">—</span></td>
                            <td class="tabular py-1.5 pe-3 text-right"><PriceDisplay :amount-cents="entry.collectedCents" /></td>
                            <td class="py-1.5 pe-3"><UBadge :color="entryStatusColor[entry.status]" variant="subtle" size="sm">{{ entry.status }}</UBadge></td>
                            <td class="py-1.5 text-muted">{{ entry.resolutionNote ?? '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <AdminPagination
            class="mt-3"
            :total="batches?.total ?? 0"
            :page="currentPage"
            :page-size="currentPageSize"
            item-label="batches"
            @update:page="goToPage"
            @update:page-size="changePageSize"
          />
        </section>
      </div>

      <!-- Import modal -->
      <UModal v-model:open="showImport">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">Import remittance batch</h3>
            <p class="text-sm text-muted">Paste the courier's own remittance report — one order per line, amounts in DZD.</p>

            <UFormField label="Courier" required>
              <USelect
                v-model="courierId"
                :items="(couriers ?? []).map((c) => ({ label: c.name, value: c.id }))"
                placeholder="Select a courier…"
                class="w-full"
              />
              <p v-if="!couriers?.length" class="mt-1 text-xs text-warning">
                No couriers yet — a courier only appears here once its first shipment has been dispatched.
              </p>
            </UFormField>
            <UFormField label="Reference" required>
              <UInput v-model="reference" placeholder="e.g. MAY-2026-001" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Period start"><UInput v-model="periodStart" type="datetime-local" class="w-full" /></UFormField>
              <UFormField label="Period end"><UInput v-model="periodEnd" type="datetime-local" class="w-full" /></UFormField>
            </div>
            <p v-if="new Date(periodStart) > new Date(periodEnd)" class="text-xs text-error">Period start must be before period end.</p>

            <UFormField label="Rows (one per line: courierRef,amount in DZD)">
              <UTextarea v-model="importRows" :rows="6" class="w-full tabular" placeholder="FS-DEMO-1001,2500&#10;FS-DEMO-1002,8900" />
            </UFormField>
            <p class="text-xs" :class="parsedRows.invalidCount ? 'text-warning' : 'text-muted'">
              {{ parsedRows.valid.length }} row{{ parsedRows.valid.length === 1 ? '' : 's' }} parsed
              <template v-if="parsedRows.invalidCount">· {{ parsedRows.invalidCount }} line{{ parsedRows.invalidCount === 1 ? '' : 's' }} skipped (expected "ref,amount")</template>
            </p>

            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showImport = false" />
              <UButton :loading="saving" :disabled="!canImport" label="Import" @click="runImport" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
