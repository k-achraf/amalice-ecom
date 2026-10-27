<script setup lang="ts">
import { formatPhoneLocal, type BlacklistAction, type BlacklistEntryView, type BlacklistType } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support'] })
useHead({ title: 'Blacklist' })

interface ListResponse {
  items: BlacklistEntryView[]
  total: number
  page: number
  pageSize: number
}

const api = useAdminApi()
const { run } = useApiAction()

const search = ref('')
const typeFilter = ref('all')
const actionFilter = ref('all')
const showReleased = ref(false)
const page = ref(1)
const pageSize = ref(20)
const data = ref<ListResponse | null>(null)
const pending = ref(true)

async function load() {
  pending.value = true
  const query: Record<string, string> = { page: String(page.value), pageSize: String(pageSize.value) }
  if (search.value.trim()) query.search = search.value.trim()
  if (typeFilter.value !== 'all') query.type = typeFilter.value
  if (actionFilter.value !== 'all') query.action = actionFilter.value
  if (showReleased.value) query.released = '1'
  data.value = await api<ListResponse>('/admin/blacklist', { query }).catch(() => null)
  pending.value = false
}
onMounted(load)

function filtersChanged() {
  page.value = 1
  return load()
}

const typeOptions = [{ label: 'Phones & addresses', value: 'all' }, { label: 'Phones', value: 'Phone' }, { label: 'Addresses', value: 'Address' }]
const actionOptions = [{ label: 'Block & warn', value: 'all' }, { label: 'Blocked', value: 'Block' }, { label: 'Warning', value: 'Warn' }]

// ---- add form ----
const form = reactive<{ type: BlacklistType; value: string; action: BlacklistAction; reason: string }>({ type: 'Phone', value: '', action: 'Block', reason: '' })
const adding = ref(false)
async function add() {
  if (!form.value.trim()) return
  adding.value = true
  const r = await run(
    () => api('/admin/blacklist', { method: 'POST', body: { type: form.type, value: form.value.trim(), action: form.action, ...(form.reason.trim() && { reason: form.reason.trim() }) } }),
    { success: 'Added to the blacklist', errorFallback: 'Could not add to the blacklist' }
  )
  adding.value = false
  if (r !== undefined) {
    form.value = ''
    form.reason = ''
    await filtersChanged()
  }
}

async function setAction(e: BlacklistEntryView, action: BlacklistAction) {
  await run(() => api(`/admin/blacklist/${e.id}`, { method: 'PATCH', body: { action } }), { success: action === 'Block' ? 'Now blocked' : 'Now a warning', errorFallback: 'Could not update the entry' })
  await load()
}
async function release(e: BlacklistEntryView) {
  if (!confirm(`Remove ${e.type === 'Phone' ? formatPhoneLocal(e.value) : 'this address'} from the blacklist? It will not be re-added automatically.`)) return
  await run(() => api(`/admin/blacklist/${e.id}`, { method: 'DELETE' }), { success: 'Removed from the blacklist', errorFallback: 'Could not remove the entry' })
  await load()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <AdsPage title="Blacklist" :description="`${data?.total ?? 0} entries · Phones and addresses with returned or fake orders`">
    <section class="card" aria-label="Add to blacklist" style="gap: 12px">
      <div class="card-head"><h2>Add manually</h2></div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end">
        <AdsSelect v-model="form.type" :options="[{ label: 'Phone number', value: 'Phone' }, { label: 'Address', value: 'Address' }]" style="width: 150px" />
        <AdsInput v-model="form.value" :placeholder="form.type === 'Phone' ? '0555 12 34 56' : 'Street, commune, wilaya (as written on the order)'" style="flex: 1; min-width: 220px" @keydown.enter="add" />
        <AdsSelect v-model="form.action" :options="[{ label: 'Block orders', value: 'Block' }, { label: 'Warn only', value: 'Warn' }]" style="width: 150px" />
        <AdsInput v-model="form.reason" placeholder="Reason (optional)" style="flex: 1; min-width: 160px" @keydown.enter="add" />
        <button class="btn btn-primary" type="button" :disabled="adding || !form.value.trim()" @click="add"><AdsIcon name="i-lucide-plus" />Add</button>
      </div>
      <p class="muted" style="margin: 0; font-size: 12px">
        Block: the order is refused at checkout. Warn: the order is accepted but marked high risk for the call center.
        Customers with 2 returned orders are warned automatically and blocked at 3. For an address, blacklisting it from an order page is more reliable than typing it.
      </p>
    </section>

    <section class="card" aria-label="Blacklist" style="padding-bottom: 16px">
      <div class="card-head">
        <AdsSelect v-model="typeFilter" :options="typeOptions" size="sm" style="width: 170px" @update:model-value="filtersChanged" />
        <AdsSelect v-model="actionFilter" :options="actionOptions" size="sm" style="width: 140px" @update:model-value="filtersChanged" />
        <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px"><input v-model="showReleased" type="checkbox" @change="filtersChanged">Show removed</label>
        <label class="search soft">
          <AdsIcon name="i-lucide-search" /><span class="sr">Search the blacklist</span>
          <input v-model="search" type="search" placeholder="Phone, address or reason" @keydown.enter="filtersChanged">
        </label>
      </div>

      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th>Entry</th><th>Status</th><th>Reason</th><th>Added</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="5" class="empty">Loading…</td></tr>
            <tr v-else-if="!data?.items.length"><td colspan="5" class="empty">Nothing on the blacklist.</td></tr>
            <tr v-for="e in data?.items" v-else :key="e.id" :style="e.active ? undefined : 'opacity: .55'">
              <td style="max-width: 320px">
                <span class="strong">{{ e.type === 'Phone' ? formatPhoneLocal(e.value) : e.label }}</span>
                <span class="sub">{{ e.type === 'Phone' ? 'Phone number' : 'Address' }}</span>
              </td>
              <td>
                <span class="pill" :class="e.action === 'Block' ? 'returned' : 'new'">{{ e.action === 'Block' ? 'Blocked' : 'Warning' }}</span>
                <span v-if="e.source === 'Auto'" class="pill outline" style="margin-left: 4px">Auto</span>
                <span v-if="!e.active" class="pill outline" style="margin-left: 4px">Removed</span>
              </td>
              <td class="muted">{{ e.reason ?? '—' }}</td>
              <td style="white-space: nowrap">{{ fmtDate(e.createdAt) }}<span v-if="e.createdByEmail" class="sub">{{ e.createdByEmail.split('@')[0] }}</span></td>
              <td class="num" style="white-space: nowrap">
                <template v-if="e.active">
                  <button v-if="e.action === 'Warn'" class="btn btn-sm" type="button" @click="setAction(e, 'Block')">Block</button>
                  <button v-else class="btn btn-sm" type="button" @click="setAction(e, 'Warn')">Warn only</button>
                  <button class="btn btn-sm" type="button" @click="release(e)">Remove</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AdsPagination :total="data?.total ?? 0" :page="page" :page-size="pageSize" item-label="entries" @update:page="(p: number) => { page = p; load() }" @update:page-size="(s: number) => { pageSize = s; filtersChanged() }" />
    </section>
  </AdsPage>
</template>
