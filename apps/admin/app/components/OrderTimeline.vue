<script setup lang="ts">
import { TIMELINE_CATEGORIES, TIMELINE_CATEGORY_LABELS, type OrderTimelineResponse, type TimelineCategory } from '@amalice/shared'

// The complete record of an order: milestones (when each stage was reached and
// how long it took) plus every operation — status changes, calls, edits, our
// shipping actions, the courier's own history, money and messages — each with
// who did it and when. Merged server-side from the audit log, call log, courier
// history and finance rows (AdminOrderTimelineService).
const props = defineProps<{ orderId: string; refreshKey?: string }>()

const api = useAdminApi()
const { run } = useApiAction()

const data = ref<OrderTimelineResponse | null>(null)
const loading = ref(true)
const filter = ref<'all' | TimelineCategory>('all')
const newestFirst = ref(true)

async function load() {
  loading.value = true
  const res = await run(() => api<OrderTimelineResponse>(`/admin/orders/${props.orderId}/timeline`), { errorFallback: 'Could not load the order history' })
  if (res) data.value = res
  loading.value = false
}
onMounted(load)
watch(() => props.refreshKey, load)

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const e of data.value?.events ?? []) c[e.category] = (c[e.category] ?? 0) + 1
  return c
})
const chips = computed(() => [
  { label: 'All', value: 'all', count: data.value?.events.length ?? 0 },
  ...TIMELINE_CATEGORIES.filter((c) => counts.value[c]).map((c) => ({ label: TIMELINE_CATEGORY_LABELS[c], value: c, count: counts.value[c] }))
])
const events = computed(() => {
  const list = (data.value?.events ?? []).filter((e) => filter.value === 'all' || e.category === filter.value)
  return newestFirst.value ? [...list].reverse() : list
})

const steps = computed(() => {
  const m = data.value?.milestones
  if (!m) return []
  const end = m.cancelledAt && !m.confirmedAt ? { key: 'cancelledAt', label: 'Cancelled', at: m.cancelledAt, bad: true } : m.returnedAt ? { key: 'returnedAt', label: 'Returned', at: m.returnedAt, bad: true } : { key: 'deliveredAt', label: 'Delivered', at: m.deliveredAt, bad: false }
  return [
    { key: 'placedAt', label: 'Placed', at: m.placedAt, bad: false },
    { key: 'firstCallAt', label: 'First call', at: m.firstCallAt, bad: false },
    { key: 'confirmedAt', label: 'Confirmed', at: m.confirmedAt, bad: false },
    { key: 'packedAt', label: 'Packed', at: m.packedAt, bad: false },
    { key: 'shippedAt', label: 'Shipped', at: m.shippedAt, bad: false },
    { key: 'outForDeliveryAt', label: 'Out for delivery', at: m.outForDeliveryAt, bad: false },
    end
  ]
})

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
function short(iso: string | null) {
  return iso ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}
function dur(minutes: number | null) {
  if (minutes == null) return null
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 6) / 10} h`
  return `${Math.round(minutes / 144) / 10} d`
}
const toneColor: Record<string, string> = { good: 'var(--teal)', warn: 'var(--brass)', bad: '#b42318', neutral: 'var(--text-2, #6b7280)' }
const categoryIcon: Record<TimelineCategory, string> = {
  order: 'i-lucide-clipboard-list',
  call: 'i-lucide-phone-call',
  edit: 'i-lucide-pencil',
  shipping: 'i-lucide-package-check',
  courier: 'i-lucide-truck',
  finance: 'i-lucide-save',
  notification: 'i-lucide-send'
}
</script>

<template>
  <section class="card" aria-labelledby="ot-h">
    <div class="card-head">
      <h2 id="ot-h">Order tracking</h2>
      <span v-if="data" class="muted" style="font-size: 12px">{{ data.events.length }} events<template v-if="data.totalCalls"> · {{ data.totalCalls }} call{{ data.totalCalls > 1 ? 's' : '' }}</template></span>
      <button class="btn btn-sm" type="button" style="margin-left: auto" :disabled="loading" @click="load"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </div>

    <div v-if="loading && !data" class="empty">Loading…</div>
    <template v-else-if="data">
      <!-- Milestones -->
      <ol style="list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; padding: 0; margin: 0">
        <li v-for="s in steps" :key="s.key" style="border: 1px solid var(--line); border-radius: var(--r); padding: 8px 10px" :style="{ opacity: s.at ? 1 : 0.5, borderColor: s.at ? (s.bad ? '#b42318' : 'var(--teal)') : undefined }">
          <div style="font-size: 12px" class="muted">{{ s.label }}</div>
          <div style="font-size: 13px; font-weight: 600">{{ short(s.at) }}</div>
        </li>
      </ol>
      <div style="display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px" class="muted">
        <span v-if="dur(data.durations.toFirstCall)">First call after <b>{{ dur(data.durations.toFirstCall) }}</b></span>
        <span v-if="dur(data.durations.toConfirm)">Confirmed after <b>{{ dur(data.durations.toConfirm) }}</b></span>
        <span v-if="dur(data.durations.confirmToShip)">Shipped <b>{{ dur(data.durations.confirmToShip) }}</b> after confirmation</span>
        <span v-if="dur(data.durations.shipToDelivery)">Delivered <b>{{ dur(data.durations.shipToDelivery) }}</b> after shipping</span>
        <span v-if="dur(data.durations.total)">Total <b>{{ dur(data.durations.total) }}</b></span>
        <span v-if="data.trackingReference">{{ data.courierName }} · <span class="mono">{{ data.trackingReference }}</span></span>
      </div>

      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <AdsTabs :model-value="filter" :items="chips" @update:model-value="(v) => (filter = v as typeof filter)" />
        <button class="btn btn-sm btn-ghost" type="button" style="margin-left: auto" @click="newestFirst = !newestFirst"><AdsIcon name="i-lucide-history" />{{ newestFirst ? 'Newest first' : 'Oldest first' }}</button>
      </div>

      <ol style="list-style: none; padding: 0; margin: 0; display: grid; gap: 0">
        <li v-for="e in events" :key="e.id" style="display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line-soft)">
          <span :style="{ color: toneColor[e.tone] }" style="display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--ivory, #f6f2e9)">
            <AdsIcon :name="categoryIcon[e.category]" style="width: 15px; height: 15px" />
          </span>
          <div style="min-width: 0">
            <div style="display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline">
              <b style="font-size: 14px">{{ e.title }}</b>
              <span class="pill neutral" style="font-size: 11px">{{ TIMELINE_CATEGORY_LABELS[e.category] }}</span>
            </div>
            <p v-if="e.detail" style="font-size: 13px; margin-top: 2px; overflow-wrap: anywhere">{{ e.detail }}</p>
            <p class="muted" style="font-size: 12px; margin-top: 2px">{{ fmt(e.at) }} · {{ e.actor }}</p>
          </div>
        </li>
        <li v-if="!events.length" class="empty">Nothing in this category.</li>
      </ol>
    </template>
  </section>
</template>
