<script setup lang="ts">
import type { AuditLog } from '@amalice/shared'

useHead({ title: 'Audit Log' })

const route = useRoute()
const router = useRouter()
const entity = ref((route.query.entity as string) ?? '')

const { data, pending } = await useAdminFetch<{ items: AuditLog[]; total: number }>('/admin/audit', { key: 'admin-audit' })

const api = useAdminApi()
async function applyEntity(v: string) {
  await router.push({ query: { entity: v || undefined, page: 1 } })
  const q: Record<string, string> = { page: '1', pageSize: '50' }
  if (v) q.entity = v
  data.value = await api<{ items: AuditLog[]; total: number }>('/admin/audit', { query: q })
}

const entityOptions = ['', 'Order', 'Product', 'AdminUser', 'RemittanceBatch', 'LedgerEntry']

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

function metaPreview(m: unknown): string {
  if (!m || typeof m !== 'object') return ''
  const obj = m as Record<string, unknown>
  if ('from' in obj && 'to' in obj) return `${obj.from} → ${obj.to}`
  if ('field' in obj && 'from' in obj) return `${obj.field}: ${obj.from} → ${obj.to}`
  return JSON.stringify(obj).slice(0, 80)
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Audit Log">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted">Entity:</span>
          <USelect
            :model-value="entity"
            :items="entityOptions.map(e => ({ label: e || 'All', value: e }))"
            class="w-48"
            @update:model-value="(v) => applyEntity(v as string)"
          />
        </div>

        <p class="text-xs text-muted">Read-only. Entries are immutable — no edit or delete exists on this screen or anywhere in the system (plan §7).</p>

        <div class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">When</th>
                <th class="px-4 py-2.5 text-left">Actor</th>
                <th class="px-4 py-2.5 text-left">Action</th>
                <th class="px-4 py-2.5 text-left">Entity</th>
                <th class="px-4 py-2.5 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="pending"><td colspan="5" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
              <tr v-else-if="!data?.items.length"><td colspan="5" class="px-4 py-12 text-center text-muted">No audit entries match this filter.</td></tr>
              <tr v-for="entry in data?.items" :key="entry.id">
                <td class="px-4 py-3 text-muted">{{ fmtDateTime(entry.createdAt ?? '') }}</td>
                <td class="px-4 py-3">{{ entry.actorEmail ?? 'system' }}</td>
                <td class="px-4 py-3"><UBadge color="neutral" variant="subtle">{{ entry.action }}</UBadge></td>
                <td class="px-4 py-3">
                  <span class="text-highlighted">{{ entry.entity }}</span>
                  <span class="tabular ml-2 text-xs text-muted">{{ entry.entityId.slice(0, 8) }}</span>
                </td>
                <td class="px-4 py-3 text-muted">{{ metaPreview(entry.metadata) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
