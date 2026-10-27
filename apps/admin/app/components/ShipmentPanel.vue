<script setup lang="ts">
import { DELIVERY_ACTION_LABELS, PICKUP_MODES, DELIVERY_CATEGORY_LABELS, type AdminOrderDetail, type DeliveryTriage, type PickupMode, type ShipmentTrackingView } from '@amalice/shared'
import { toast } from 'vue-sonner'

// The courier's view of an order's parcel (all Ecotrack-based shipping
// companies): confirmation state, status, driver, desk, fees, the delivery
// history with failed-attempt reasons, and the actions that exist at the
// courier — confirm ("Expedier"), refresh, label, note for the driver, request
// return, and cancel/delete while it hasn't been confirmed yet.
const props = defineProps<{ order: AdminOrderDetail }>()
const emit = defineEmits<{ changed: []; refreshed: [] }>()

const api = useAdminApi()
const { run } = useApiAction()

const shipment = computed(() => props.order.shipment!)
const viaCompany = computed(() => props.order.fulfillmentMethod === 'ShippingCompany' && !!shipment.value.trackingReference && shipment.value.courierStatus !== 'manual_dispatch')
const confirmed = computed(() => !!shipment.value.carrierConfirmedAt)
const tracking = ref<ShipmentTrackingView | null>(null)
const acting = ref<'confirm' | 'refresh' | 'label' | 'note' | 'return' | 'cancel' | null>(null)
const noteText = ref('')

// AI reading of the courier's notes (POST admin/orders/:id/delivery-triage): read-only,
// a category and a suggested next step; nothing on the order changes.
const triage = ref<DeliveryTriage | null>(null)
const triaging = ref(false)
async function analyzeNotes() {
  triaging.value = true
  const res = await run(() => api<DeliveryTriage>(`/admin/orders/${props.order.id}/delivery-triage`, { method: 'POST' }), {
    errorFallback: 'Could not analyze the courier notes'
  })
  triaging.value = false
  if (res) triage.value = res
}

async function load(refresh: boolean) {
  const res = await run(() => api<ShipmentTrackingView>(`/admin/fulfillment/orders/${props.order.id}/tracking`, { query: refresh ? { refresh: '1' } : {} }), {
    errorFallback: 'Could not read the courier'
  })
  if (res) tracking.value = res
  return res
}

// The courier is read ONCE, when the page is opened. There is no automatic re-read and no
// polling: after this only the Refresh button (or an action below) reads it again.
const initialLoading = ref(true)
onMounted(async () => {
  const before = props.order.shipment?.courierStatus ?? null
  const view = await load(viaCompany.value)
  initialLoading.value = false
  emit('refreshed')
  // Tell the page only when the courier actually changed something about the order.
  if (view && view.courierStatus !== before) emit('changed')
})

async function refreshNow() {
  acting.value = 'refresh'
  const before = props.order.shipment?.courierStatus ?? null
  const view = await load(true)
  acting.value = null
  emit('refreshed')
  if (view && view.courierStatus !== before) emit('changed')
}

// Ramassage (courier collects) or vers station (we drop it off): the person confirming chooses.
const pickupMode = ref<PickupMode | ''>('')
const pickupOptions = PICKUP_MODES.map((m) => ({ label: m.label, value: m.value }))
async function confirmShipment() {
  const mode = PICKUP_MODES.find((m) => m.value === pickupMode.value)
  if (!mode) return
  acting.value = 'confirm'
  const res = await run(() => api(`/admin/fulfillment/orders/${props.order.id}/request-pickup`, { method: 'POST', body: { askCollection: mode.askCollection } }), {
    success: mode.askCollection ? 'Confirmed with the courier — they will collect it' : 'Confirmed with the courier — drop the parcel at their station',
    errorFallback: 'Could not confirm the shipment'
  })
  acting.value = null
  if (res !== undefined) { await load(false); emit('changed') }
}

async function downloadLabel() {
  acting.value = 'label'
  await run(async () => {
    const blob = await api<Blob>(`/admin/fulfillment/orders/${props.order.id}/label`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `label-${props.order.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, { errorFallback: 'Could not download the label' })
  acting.value = null
}

async function sendNote() {
  if (!noteText.value.trim()) return
  acting.value = 'note'
  const res = await run(() => api(`/admin/fulfillment/orders/${props.order.id}/courier-note`, { method: 'POST', body: { content: noteText.value.trim() } }), {
    success: 'Note sent to the courier',
    errorFallback: 'Could not send the note'
  })
  acting.value = null
  if (res !== undefined) { noteText.value = ''; await load(true) }
}

async function requestReturn() {
  if (!window.confirm('Ask the courier to bring this parcel back? They may ignore the request.')) return
  acting.value = 'return'
  const res = await run(() => api(`/admin/fulfillment/orders/${props.order.id}/request-return`, { method: 'POST' }), {
    success: 'Return requested',
    errorFallback: 'Could not request the return'
  })
  acting.value = null
  if (res !== undefined) toast.info('The courier may ignore the request — watch the status.')
}

async function cancelShipment() {
  acting.value = 'cancel'
  const res = await run(() => api(`/admin/fulfillment/orders/${props.order.id}/cancel-shipment`, { method: 'POST' }), {
    success: 'Shipment cancelled',
    errorFallback: 'Could not cancel the shipment'
  })
  acting.value = null
  if (res !== undefined) emit('changed')
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}
function dzd(cents: number | null) {
  return cents == null ? '—' : `${Math.round(cents / 100).toLocaleString('en')} DA`
}
const activity = computed(() => [...(tracking.value?.activity ?? [])].reverse())
const canRequestReturn = computed(() => viaCompany.value && confirmed.value && props.order.state === 'OutForDelivery')
// A courier-side cancel means our order can't follow: surface it.
const courierCancelled = computed(() => /annul/i.test(tracking.value?.courierStatus ?? shipment.value.courierStatus ?? ''))
</script>

<template>
  <section class="card" aria-labelledby="sh-h">
    <div class="card-head">
      <h2 id="sh-h">Shipment</h2>
      <AdsLozenge v-if="!viaCompany" tone="connected">{{ order.fulfillmentMethod === 'Manual' ? 'Own driver' : 'Marked as sent' }}</AdsLozenge>
      <AdsLozenge v-else-if="!confirmed" tone="new">Awaiting courier confirmation</AdsLozenge>
      <AdsLozenge v-else tone="connected">Confirmed by courier</AdsLozenge>
    </div>

    <div v-if="viaCompany && !confirmed" class="notice warn">
      <AdsIcon name="i-lucide-alert-triangle" />
      <span>The parcel is created at {{ shipment.courier.name }} but not confirmed: they will not collect it yet. You can still edit the delivery details or cancel it. After confirming, it is locked.</span>
    </div>
    <div v-if="courierCancelled" class="notice danger">
      <AdsIcon name="i-lucide-alert-triangle" />
      <span>{{ shipment.courier.name }} reports this parcel as cancelled. Check with them before doing anything else.</span>
    </div>

    <dl class="details">
      <dt>Courier</dt><dd>{{ shipment.courier.name }}</dd>
      <dt>Tracking ref</dt><dd class="mono">{{ shipment.trackingReference ?? '— (no tracking number)' }}</dd>
      <dt>Courier status</dt><dd>{{ tracking?.courierStatus ?? shipment.courierStatus ?? '—' }}</dd>
      <template v-if="tracking?.driverName || tracking?.driverPhone || shipment.driverName || shipment.driverPhone">
        <dt>Driver</dt>
        <dd>{{ tracking?.driverName || shipment.driverName || '—' }} <a v-if="tracking?.driverPhone || shipment.driverPhone" :href="`tel:${tracking?.driverPhone || shipment.driverPhone}`" class="mono">{{ tracking?.driverPhone || shipment.driverPhone }}</a></dd>
      </template>
      <template v-if="tracking?.lastFailureReason">
        <dt>Last attempt</dt><dd>{{ tracking.lastFailureReason }}</dd>
      </template>
      <template v-if="tracking?.postponedTo">
        <dt>Postponed to</dt><dd>{{ fmt(tracking.postponedTo) }}</dd>
      </template>
      <template v-if="tracking?.desk">
        <dt>Stop desk</dt>
        <dd>
          {{ [tracking.desk.commune, tracking.desk.address].filter(Boolean).join(' · ') || '—' }}
          <a v-if="tracking.desk.phone" :href="`tel:${tracking.desk.phone}`" class="mono">{{ tracking.desk.phone }}</a>
          <a v-if="tracking.desk.mapLink" :href="tracking.desk.mapLink" target="_blank" rel="noopener"> map</a>
        </dd>
      </template>
      <template v-if="(tracking?.carrierFeeCents ?? shipment.carrierFeeCents) != null">
        <dt>Courier fee</dt><dd>{{ dzd(tracking?.carrierFeeCents ?? shipment.carrierFeeCents) }}<span class="muted"> · return {{ dzd(tracking?.returnFeeCents ?? shipment.returnFeeCents) }}</span></dd>
      </template>
      <template v-if="tracking?.lastSyncedAt">
        <dt>Last checked</dt><dd>{{ fmt(tracking.lastSyncedAt) }}</dd>
      </template>
    </dl>

    <div style="display: flex; flex-wrap: wrap; gap: 8px">
      <AdsSelect v-if="viaCompany && !confirmed" v-model="pickupMode" :options="pickupOptions" placeholder="Ramassage or vers station…" aria-label="How the parcel reaches the courier" style="min-width: 230px" />
      <button v-if="viaCompany && !confirmed" class="btn btn-primary" type="button" :disabled="acting === 'confirm' || !pickupMode" @click="confirmShipment"><AdsIcon name="i-lucide-package-check" />Confirm with courier</button>
      <button v-if="viaCompany" class="btn" type="button" :disabled="acting === 'refresh' || initialLoading" @click="refreshNow"><AdsIcon name="i-lucide-refresh-cw" />{{ initialLoading || acting === 'refresh' ? 'Reading the courier…' : 'Refresh from courier' }}</button>
      <button v-if="viaCompany" class="btn" type="button" :disabled="acting === 'label'" @click="downloadLabel"><AdsIcon name="i-lucide-file-down" />Download label</button>
      <button v-if="canRequestReturn" class="btn" type="button" :disabled="acting === 'return'" @click="requestReturn"><AdsIcon name="i-lucide-rotate-ccw" />Request return</button>
      <button v-if="!viaCompany || !confirmed" class="btn btn-danger" type="button" :disabled="acting === 'cancel'" @click="cancelShipment"><AdsIcon name="i-lucide-x" />Cancel shipment</button>
    </div>

    <!-- Note for the driver / delivery company -->
    <div v-if="viaCompany && confirmed" class="field">
      <label class="label" for="courier-note">Note for the courier</label>
      <div style="display: flex; gap: 8px">
        <input id="courier-note" v-model="noteText" class="input" maxlength="255" placeholder="e.g. Customer asks to be called before 17:00" @keydown.enter="sendNote">
        <button class="btn" type="button" :disabled="acting === 'note' || !noteText.trim()" @click="sendNote"><AdsIcon name="i-lucide-send" />Send</button>
      </div>
    </div>

    <!-- AI reading of the courier's notes -->
    <div v-if="activity.length || tracking?.updates.length" class="stack" style="gap: 6px">
      <div v-if="triage" class="notice" style="display: block">
        <b>{{ DELIVERY_CATEGORY_LABELS[triage.category] }}</b>
        <span class="muted"> · confidence {{ triage.confidence }}</span>
        <p style="margin: 4px 0 0">{{ triage.summary }}</p>
        <p v-if="triage.hasNotes" style="margin: 4px 0 0"><b>{{ DELIVERY_ACTION_LABELS[triage.nextAction] }}:</b> {{ triage.nextStep }}</p>
      </div>
      <div><button class="btn" type="button" :disabled="triaging" @click="analyzeNotes"><AdsIcon name="i-lucide-sparkles" />{{ triaging ? 'Reading the notes…' : triage ? 'Analyze again' : 'Analyze notes with AI' }}</button></div>
    </div>

    <!-- Courier history -->
    <div v-if="activity.length || tracking?.updates.length" class="stack" style="gap: 6px">
      <h3 style="font-size: 14px">Courier history</h3>
      <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; max-height: 260px; overflow-y: auto">
        <li v-for="(a, i) in activity" :key="`a${i}`" style="font-size: 13px">
          <b>{{ a.reason ?? 'Update' }}</b>
          <span class="muted"> {{ fmt(a.at) }}<template v-if="a.station"> · {{ a.station }}</template><template v-if="a.driver"> · {{ a.driver }}</template></span>
          <span v-if="a.details" style="display: block">{{ a.details }}</span>
          <span v-if="a.postponedTo" class="muted" style="display: block">Postponed to {{ a.postponedTo }}</span>
        </li>
        <li v-for="(u, i) in tracking?.updates ?? []" :key="`u${i}`" style="font-size: 13px">
          <b>Remark</b><span class="muted"> {{ fmt(u.at) }}<template v-if="u.driver"> · {{ u.driver }}</template></span>
          <span style="display: block">{{ u.remark }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
