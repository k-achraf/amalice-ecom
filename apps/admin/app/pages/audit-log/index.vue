<script setup lang="ts">

import type { AuditLog } from '@amalice/shared'

useHead({ title: 'Audit Log' })

const route = useRoute()
const router = useRouter()
const entity = ref((route.query.entity as string) ?? '')

const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 50))

const { data, pending } = await useAdminFetch<{ items: AuditLog[]; total: number; pageSize: number }>('/admin/audit', {
  key: 'admin-audit',
  query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '50', entity: route.query.entity }
})

const api = useAdminApi()
async function load() {
  const q: Record<string, string> = { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  if (entity.value) q.entity = entity.value
  data.value = await api<{ items: AuditLog[]; total: number; pageSize: number }>('/admin/audit', { query: q })
}

async function applyEntity(v: string) {
  entity.value = v
  await router.push({ query: { entity: v || undefined, page: 1 } })
  await load()
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await load()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await load()
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
  <AdsPage title="Audit log" :description="`${data?.total ?? 0} entries · Business events across the platform`">
    <section class="card" aria-label="Audit log">
      <div class="card-head">
        <label class="field" style="flex-direction: row; align-items: center; gap: 10px">
          <span class="muted">Entity</span>
          <AdsSelect :model-value="entity" :options="entityOptions.map((e) => ({ label: e || 'All', value: e }))" size="sm" style="width: 190px" @update:model-value="(v) => applyEntity(v as string)" />
        </label>
        <span class="muted">Read-only. Entries are immutable — nothing can edit or delete them.</span>
      </div>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="5" class="empty">Loading…</td></tr>
            <tr v-else-if="!data?.items.length"><td colspan="5" class="empty">No audit entries match this filter.</td></tr>
            <tr v-for="entry in data?.items" v-else :key="entry.id">
              <td class="muted">{{ fmtDateTime(entry.createdAt ?? '') }}</td>
              <td>{{ entry.actorEmail ?? 'system' }}</td>
              <td><span class="pill neutral">{{ entry.action }}</span></td>
              <td><span class="strong">{{ entry.entity }}</span> <span class="mono muted">{{ entry.entityId.slice(0, 8) }}</span></td>
              <td class="muted">{{ metaPreview(entry.metadata) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdsPagination :total="data?.total ?? 0" :page="currentPage" :page-size="currentPageSize" item-label="entries" @update:page="goToPage" @update:page-size="changePageSize" />
    </section>
  </AdsPage>
</template>
