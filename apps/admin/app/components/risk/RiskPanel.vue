<script setup lang="ts">
import { RISK_FACTOR_LABELS, type BlacklistAction, type BlacklistEntryView } from '@amalice/shared'

// Order-page card: why the order scored what it did, plus one-click
// blacklisting of this order's phone / delivery address.
const props = defineProps<{
  orderId: string
  level: 'Low' | 'Medium' | 'High' | null
  score: number | null
  factors: Array<{ code: string; points: number; detail?: string }> | null
  canManage: boolean
}>()

const api = useAdminApi()
const { run } = useApiAction()
const entries = ref<{ phone: BlacklistEntryView | null; address: BlacklistEntryView | null } | null>(null)
const busy = ref(false)

async function load() {
  entries.value = await api(`/admin/orders/${props.orderId}/blacklist`).catch(() => null)
}
onMounted(load)
watch(() => props.orderId, load)

async function add(type: 'Phone' | 'Address', action: BlacklistAction) {
  if (action === 'Block' && !confirm(`Block this ${type === 'Phone' ? 'phone number' : 'address'}? New orders from it will be refused at checkout.`)) return
  busy.value = true
  await run(() => api('/admin/blacklist', { method: 'POST', body: { type, action, orderId: props.orderId } }), { success: `${type === 'Phone' ? 'Phone' : 'Address'} ${action === 'Block' ? 'blocked' : 'flagged'}`, errorFallback: 'Could not update the blacklist' })
  await load()
  busy.value = false
}
async function release(entry: BlacklistEntryView) {
  busy.value = true
  await run(() => api(`/admin/blacklist/${entry.id}`, { method: 'DELETE' }), { success: 'Removed from the blacklist', errorFallback: 'Could not update the blacklist' })
  await load()
  busy.value = false
}

const rows = computed(() => [
  { type: 'Phone' as const, label: 'Phone number', entry: entries.value?.phone ?? null },
  { type: 'Address' as const, label: 'Delivery address', entry: entries.value?.address ?? null }
])
</script>

<template>
  <section v-if="level || entries?.phone || entries?.address" class="card" aria-label="Order risk" style="gap: 12px">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
      <h2 style="margin: 0; font-size: 15px">Return risk</h2>
      <RiskBadge :level="level" :score="score" />
    </div>
    <ul v-if="factors?.length" style="margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13px">
      <li v-for="f in factors" :key="f.code" style="display: flex; gap: 8px">
        <span class="strong" style="min-width: 36px" :style="{ color: f.points > 0 ? 'var(--danger-fg)' : 'var(--teal)' }">{{ f.points > 0 ? '+' : '' }}{{ f.points }}</span>
        <span>{{ RISK_FACTOR_LABELS[f.code] ?? f.code }}<span v-if="f.detail" class="muted"> · {{ f.detail }}</span></span>
      </li>
    </ul>
    <p v-else class="muted" style="margin: 0; font-size: 13px">No risk signals for this order.</p>

    <div v-if="canManage || entries?.phone || entries?.address" style="display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px">
      <div v-for="r in rows" :key="r.type" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px">
        <span style="min-width: 120px">{{ r.label }}</span>
        <template v-if="r.entry">
          <span class="pill" :class="r.entry.action === 'Block' ? 'returned' : 'new'">{{ r.entry.action === 'Block' ? 'Blocked' : 'Warning' }}{{ r.entry.source === 'Auto' ? ' · auto' : '' }}</span>
          <button v-if="canManage" class="btn btn-sm" type="button" :disabled="busy" @click="release(r.entry)">Remove</button>
        </template>
        <template v-else-if="canManage">
          <button class="btn btn-sm" type="button" :disabled="busy" @click="add(r.type, 'Warn')">Flag</button>
          <button class="btn btn-sm btn-danger" type="button" :disabled="busy" @click="add(r.type, 'Block')">Block</button>
        </template>
      </div>
    </div>
  </section>
</template>
