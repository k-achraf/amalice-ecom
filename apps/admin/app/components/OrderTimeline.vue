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
// Two separate records: our own system's history, and what the shipping company reports.
const view = ref<'system' | 'courier'>('system')
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
const courier = computed(() => data.value?.courier ?? null)
const events = computed(() => {
  const source = view.value === 'courier' ? (courier.value?.events ?? []) : (data.value?.events ?? [])
  const list = source.filter((e) => view.value === 'courier' || filter.value === 'all' || e.category === filter.value)
  return newestFirst.value ? [...list].reverse() : list
})
const dzd = (cents: number | null) => (cents == null ? '—' : `${Math.round(cents / 100).toLocaleString('en')} DA`)

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

function fmtFull(iso: string | null) {
  return iso ? fmt(iso) : '—'
}
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
      <!-- Two separate records -->
      <div class="views" role="tablist" aria-label="Tracking view">
        <button type="button" role="tab" :aria-selected="view === 'system'" class="view" @click="view = 'system'">
          <AdsIcon name="i-lucide-clipboard-list" />
          <span><b>Our system</b><small>Order status, calls, edits and our actions</small></span>
        </button>
        <button type="button" role="tab" :aria-selected="view === 'courier'" class="view" @click="view = 'courier'">
          <AdsIcon name="i-lucide-truck" />
          <span><b>Shipping company</b><small>{{ courier ? `${courier.courierName}${courier.statusLabel ? ` · ${courier.statusLabel}` : ''}` : 'Not sent yet' }}</small></span>
        </button>
      </div>

      <!-- ===== Our system ===== -->
      <template v-if="view === 'system'">
        <p class="muted" style="font-size: 12px">The status here is the order’s status in <b>our system</b>, including changes our system made after the courier reported something.</p>
        <ol class="miles">
          <li v-for="s in steps" :key="s.key" :style="{ opacity: s.at ? 1 : 0.5, borderColor: s.at ? (s.bad ? '#b42318' : 'var(--teal)') : undefined }">
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
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
          <AdsTabs :model-value="filter" :items="chips" @update:model-value="(v) => (filter = v as typeof filter)" />
          <button class="btn btn-sm btn-ghost" type="button" style="margin-left: auto" @click="newestFirst = !newestFirst"><AdsIcon name="i-lucide-history" />{{ newestFirst ? 'Newest first' : 'Oldest first' }}</button>
        </div>
      </template>

      <!-- ===== Shipping company ===== -->
      <template v-else>
        <div v-if="!courier" class="empty">This order has not been sent to a shipping company yet.</div>
        <template v-else>
          <p class="muted" style="font-size: 12px">What <b>{{ courier.courierName }}</b> reports about the parcel, in its own words. It is kept separate from our order status.<template v-if="!courier.viaApi"> This shipment was recorded by hand, so the company reports nothing back automatically.</template></p>
          <dl class="facts">
            <div><dt>Courier status</dt><dd><b>{{ courier.statusLabel ?? '—' }}</b><small v-if="courier.statusCode" class="mono muted"> {{ courier.statusCode }}</small></dd></div>
            <div><dt>Tracking number</dt><dd class="mono">{{ courier.trackingReference ?? '—' }}</dd></div>
            <div><dt>Confirmed by courier</dt><dd>{{ courier.confirmed ? fmtFull(courier.confirmedAt) : 'Not yet' }}</dd></div>
            <div v-if="courier.driverName || courier.driverPhone"><dt>Driver</dt><dd>{{ courier.driverName ?? '—' }} <a v-if="courier.driverPhone" :href="`tel:${courier.driverPhone}`" class="mono">{{ courier.driverPhone }}</a></dd></div>
            <div v-if="courier.desk"><dt>Stop desk</dt><dd>{{ [courier.desk.commune, courier.desk.address].filter(Boolean).join(' · ') || '—' }}<template v-if="courier.desk.phone"> · <a :href="`tel:${courier.desk.phone}`" class="mono">{{ courier.desk.phone }}</a></template></dd></div>
            <div v-if="courier.lastFailureReason"><dt>Last delivery attempt</dt><dd>{{ courier.lastFailureReason }}</dd></div>
            <div v-if="courier.postponedTo"><dt>Postponed to</dt><dd>{{ fmtFull(courier.postponedTo) }}</dd></div>
            <div v-if="courier.carrierFeeCents != null"><dt>Courier fee</dt><dd>{{ dzd(courier.carrierFeeCents) }} <span class="muted">· return {{ dzd(courier.returnFeeCents) }}</span></dd></div>
            <div><dt>Last checked</dt><dd>{{ fmtFull(courier.lastSyncedAt) }}</dd></div>
          </dl>
          <div style="display: flex; align-items: center; gap: 8px">
            <h3 style="font-size: 14px">Courier history <small class="muted">({{ courier.events.length }})</small></h3>
            <button class="btn btn-sm btn-ghost" type="button" style="margin-left: auto" @click="newestFirst = !newestFirst"><AdsIcon name="i-lucide-history" />{{ newestFirst ? 'Newest first' : 'Oldest first' }}</button>
          </div>
        </template>
      </template>

      <ol v-if="view === 'system' || courier" style="list-style: none; padding: 0; margin: 0; display: grid; gap: 0">
        <li v-for="e in events" :key="e.id" class="ev">
          <span :style="{ color: toneColor[e.tone] }" class="ico">
            <AdsIcon :name="categoryIcon[e.category]" style="width: 15px; height: 15px" />
          </span>
          <div style="min-width: 0">
            <div style="display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline">
              <b style="font-size: 14px">{{ e.title }}</b>
              <span v-if="view === 'system'" class="pill neutral" style="font-size: 11px">{{ TIMELINE_CATEGORY_LABELS[e.category] }}</span>
            </div>
            <p v-if="e.detail" style="font-size: 13px; margin-top: 2px; overflow-wrap: anywhere">{{ e.detail }}</p>
            <p class="muted" style="font-size: 12px; margin-top: 2px">{{ fmt(e.at) }} · {{ e.actor }}</p>
          </div>
        </li>
        <li v-if="!events.length" class="empty">{{ view === 'courier' ? 'The courier has not reported anything yet. Use “Refresh from courier” in the Shipment card.' : 'Nothing in this category.' }}</li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.views { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.view { display: flex; align-items: center; gap: 10px; text-align: start; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r); background: var(--white); color: var(--pine); font: inherit; cursor: pointer; }
.view[aria-selected='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); background: var(--hover); }
.view svg { width: 18px; height: 18px; flex-shrink: 0; color: var(--teal); }
.view span { display: flex; flex-direction: column; min-width: 0; }
.view small { font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.miles { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; padding: 0; margin: 0; }
.miles li { border: 1px solid var(--line); border-radius: var(--r); padding: 8px 10px; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 16px; margin: 0; }
.facts dt { font-size: 12px; color: var(--text-2); }
.facts dd { margin: 2px 0 0; font-size: 13px; overflow-wrap: anywhere; }
.ev { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line-soft); }
.ico { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--ivory, #f6f2e9); }
</style>
