<script setup lang="ts">
import type { RemittanceBatch, LedgerEntry, RemittanceBatchStatus } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'Finance'] })
useHead({ title: 'Reconciliation' })

const route = useRoute()
const router = useRouter()
const api = useAdminApi()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 20))

const { data: batches, pending } = await useAdminFetch<{ items: RemittanceBatch[]; total: number; pageSize: number }>(
  '/admin/reconciliation/batches',
  { key: 'admin-recon-batches', query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '20' } }
)

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
const { data: discrepancies } = await useAdminFetch<(LedgerEntry & { deltaCents?: number | null })[]>(
  '/admin/reconciliation/discrepancies',
  { key: 'admin-recon-discrepancies' }
)

const statusColor: Record<RemittanceBatchStatus, string> = {
  Imported: 'info',
  Matched: 'success',
  Discrepancy: 'warning',
  Settled: 'success'
}

// Import modal — FIN-02
const showImport = ref(false)
const saving = ref(false)
const importRows = ref('')
const courierId = ref('')
const reference = ref('')
const periodStart = ref('')
const periodEnd = ref('')

async function runImport() {
  saving.value = true
  try {
    // Parse the pasted CSV-ish rows: "courierRef,collectedCents" per line.
    const rows = importRows.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [courierRef, collectedCents] = l.split(',').map((s) => s.trim())
        return { courierRef, collectedCents: Number(collectedCents) }
      })
    await api('/admin/reconciliation/batches', {
      method: 'POST',
      body: { courierId: courierId.value, reference: reference.value, periodStart: periodStart.value, periodEnd: periodEnd.value, rows }
    })
    showImport.value = false
    importRows.value = ''
    reference.value = ''
    await loadBatches()
  } finally {
    saving.value = false
  }
}

async function runMatch(batchId: string) {
  await api(`/admin/reconciliation/batches/${batchId}/match`, { method: 'POST' })
  await loadBatches()
}

const resolving = ref<string | null>(null)
const resolveNote = ref('')
async function resolve(entryId: string) {
  if (!resolveNote.value) return
  resolving.value = entryId
  try {
    await api(`/admin/reconciliation/entries/${entryId}/resolve`, { method: 'POST', body: { resolutionNote: resolveNote.value } })
    resolveNote.value = ''
    resolving.value = null
    await loadBatches()
  } finally {
    resolving.value = null
  }
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
                      <UInput v-model="resolveNote" placeholder="reason…" size="xs" class="w-32" />
                      <UButton size="xs" :loading="resolving === e.id" :disabled="!resolveNote" label="Resolve" @click="resolve(e.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Batches (FIN-01/03) -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Remittance batches</h2>
          <div class="admin-table-wrap">
            <table class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-4 py-2.5 text-left">Reference</th>
                  <th class="px-4 py-2.5 text-left">Courier</th>
                  <th class="px-4 py-2.5 text-left">Period</th>
                  <th class="px-4 py-2.5 text-right">Total</th>
                  <th class="px-4 py-2.5 text-left">Status</th>
                  <th class="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="pending"><td colspan="6" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
                <tr v-else-if="!batches?.items.length"><td colspan="6" class="px-4 py-12 text-center text-muted">No batches yet.</td></tr>
                <tr v-for="b in batches?.items" :key="b.id">
                  <td class="px-4 py-3 font-medium">{{ b.reference }}</td>
                  <td class="px-4 py-3 text-muted">{{ b.courierName ?? '—' }}</td>
                  <td class="px-4 py-3 text-muted text-xs">{{ b.periodStart?.slice(0, 10) }} → {{ b.periodEnd?.slice(0, 10) }}</td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="b.totalCents" /></td>
                  <td class="px-4 py-3"><UBadge :color="(statusColor[b.status] as 'success' | 'warning' | 'info')" variant="subtle">{{ b.status }}</UBadge></td>
                  <td class="px-4 py-3 text-right">
                    <UButton size="xs" variant="soft" color="primary" label="Auto-match" @click="runMatch(b.id)" />
                  </td>
                </tr>
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
            <UFormField label="Courier ID">
              <UInput v-model="courierId" placeholder="UUID" class="w-full" />
            </UFormField>
            <UFormField label="Reference">
              <UInput v-model="reference" placeholder="e.g. MAY-2026-001" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Period start"><UInput v-model="periodStart" type="datetime-local" class="w-full" /></UFormField>
              <UFormField label="Period end"><UInput v-model="periodEnd" type="datetime-local" class="w-full" /></UFormField>
            </div>
            <UFormField label="Rows (one per line: courierRef,collectedCents)">
              <UTextarea v-model="importRows" :rows="6" class="w-full tabular" placeholder="FS-DEMO-1001,2500&#10;FS-DEMO-1002,8900" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showImport = false" />
              <UButton :loading="saving" label="Import" @click="runImport" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
