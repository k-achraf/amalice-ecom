<script setup lang="ts">
import { PICKUP_MODES, type AdminOrderListItem, type OrderCourierLocation, type OrderFilterKey,type OrderListResponse, type PickupMode, type ShippingCompanyView } from '@amalice/shared'
import { toast } from 'vue-sonner'

// Stage 2 of the order pipeline: warehouse picks/packs a call-center-confirmed
// order, then hands it to a courier — which is where fulfillment's job ends
// and shipping's begins (see shipping/index.vue for HandedToCourier onward).
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Fulfillment' })

const api = useAdminApi()
const { run } = useApiAction()

// One filter bar for every section; its query is spread into each section's fetch
// (reactive, so the sections refetch whenever a filter changes).
const { filters, query: filterQuery } = useOrderFilters({ syncRoute: true })
const FILTER_FIELDS: OrderFilterKey[] = ['productId', 'offerId', 'funnelId', 'companyId', 'region', 'city', 'shippingType', 'platform', 'riskLevel', 'minTotal', 'maxTotal', 'from', 'to', 'hasTracking', 'confirmedByCourier']
const sectionQuery = (state: string, pageSize: number) =>
  computed(() => ({ state, pageSize, ...filterQuery.value })) as unknown as Record<string, unknown>

const { data: confirmed, pending: pendingConfirmed, refresh: refreshConfirmed } = await useAdminFetch<OrderListResponse>(
  '/admin/orders',
  { query: sectionQuery('Confirmed', 50), key: 'admin-fulfillment-confirmed' }
)
const { data: packed, pending: pendingPacked, refresh: refreshPacked } = await useAdminFetch<OrderListResponse>(
  '/admin/orders',
  { query: sectionQuery('Packed', 50), key: 'admin-fulfillment-packed' }
)
// On hold — a confirmed order that can't be packed as-is (e.g. stock ran
// out between confirm and pack) without cancelling it outright. See
// OrderState's Prisma comment.
const { data: onHold, pending: pendingOnHold, refresh: refreshOnHold } = await useAdminFetch<OrderListResponse>(
  '/admin/orders',
  { query: sectionQuery('OnHold', 50), key: 'admin-fulfillment-onhold' }
)

// Parcels created at a courier but not yet confirmed ("Expedier"): the courier
// won't collect them until they are.
const { data: handedOver, refresh: refreshHandedOver } = await useAdminFetch<OrderListResponse>(
  '/admin/orders',
  { query: sectionQuery('HandedToCourier', 100), key: 'admin-fulfillment-handed' }
)
const unconfirmed = computed(() =>
  (handedOver.value?.items ?? []).filter((o) => o.fulfillmentMethod === 'ShippingCompany' && o.shipment?.trackingReference && !o.shipment.carrierConfirmedAt)
)

const acting = ref<string | null>(null)
const { labelSelected, printing, toggleLabel, toggleAllLabels, printLabels } = usePrintLabels()

// Couriers that can be assigned straight from the queue (no trip to the order page).
const { data: shippingCompanies } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', { key: 'admin-shipping-companies-picker' })
const companyOptions = computed(() =>
  (shippingCompanies.value ?? []).filter((c) => c.isLinked && c.id).map((c) => ({ label: c.name, value: c.id as string }))
)
async function assignCompany(orderId: string, shippingCompanyId: unknown) {
  if (typeof shippingCompanyId !== 'string' || !shippingCompanyId) return
  acting.value = orderId
  const name = companyOptions.value.find((c) => c.value === shippingCompanyId)?.label
  await run(() => api(`/admin/fulfillment/orders/${orderId}/assign-company`, { method: 'POST', body: { shippingCompanyId } }), {
    success: name ? `Assigned to ${name}` : 'Shipping company assigned',
    errorFallback: 'Could not assign the shipping company'
  })
  await refreshPacked()
  acting.value = null
}
// Convert location: the list items don't carry the courier conversion, so it is loaded
// lazily per Packed row that has a courier assigned.
const locApi = useCourierLocationApi()
const courierLocs = ref<Record<string, OrderCourierLocation>>({})
const convertOrderId = ref<string | null>(null)
const convertOpen = ref(false)
async function loadCourierLoc(orderId: string) {
  try {
    courierLocs.value = { ...courierLocs.value, [orderId]: await locApi.get(orderId) }
  } catch { /* the dialog reports its own errors */ }
}
watch(() => packed.value?.items, (items) => {
  for (const o of items ?? []) if (o.fulfillmentMethod === 'ShippingCompany' && o.shippingCompanyId) loadCourierLoc(o.id)
}, { immediate: true })
const needsConvert = (o: AdminOrderListItem) => Number(courierLocs.value[o.id]?.ourWilaya.id) >= 59
function openConvert(orderId: string) {
  convertOrderId.value = orderId
  convertOpen.value = true
}
async function onConverted() {
  if (convertOrderId.value) await loadCourierLoc(convertOrderId.value)
  await refreshPacked()
}

// One selection per table. Packed accepts every row (assign / move back need no courier);
// "Send" only acts on the ones that already have a courier account.
const confSel = useBulkSelection()
const holdSel = useBulkSelection()
const packedSel = useBulkSelection()
const { bulkTransition, busy: moving } = useBulkTransition()
// Selections refer to rows that may no longer be listed once the filters change.
watch(filterQuery, () => {
  confSel.clear()
  holdSel.clear()
  packedSel.clear()
  labelSelected.value = new Set()
})
// ...and after every refresh, ids that left the list are dropped so they are never sent.
watch(() => confirmed.value?.items, (items) => confSel.keepOnly((items ?? []).map((o) => o.id)))
watch(() => onHold.value?.items, (items) => holdSel.keepOnly((items ?? []).map((o) => o.id)))
watch(() => packed.value?.items, (items) => packedSel.keepOnly((items ?? []).map((o) => o.id)))
watch(unconfirmed, (items) => {
  const keep = new Set(items.map((o) => o.id))
  const next = new Set([...labelSelected.value].filter((id) => keep.has(id)))
  if (next.size !== labelSelected.value.size) labelSelected.value = next
})

const selectable = (o: AdminOrderListItem) => o.fulfillmentMethod === 'ShippingCompany' && !!o.shippingCompanyId
const confirmedIds = computed(() => (confirmed.value?.items ?? []).map((o) => o.id))
const onHoldIds = computed(() => (onHold.value?.items ?? []).map((o) => o.id))
const packedIds = computed(() => (packed.value?.items ?? []).map((o) => o.id))
const unconfirmedIds = computed(() => unconfirmed.value.map((o) => o.id))
const dispatchableSelected = computed(() => (packed.value?.items ?? []).filter((o) => packedSel.has(o.id) && selectable(o)))

// Confirm dialog shared by every bulk transition.
type SectionKey = 'confirmed' | 'onHold' | 'packed'
const pendingMove = ref<{ section: SectionKey; to: 'Confirmed' | 'Packed' | 'OnHold' | 'CancelledShipping'; label: string; verb: string } | null>(null)
const selections = { confirmed: confSel, onHold: holdSel, packed: packedSel }
function askMove(section: SectionKey, to: 'Confirmed' | 'Packed' | 'OnHold' | 'CancelledShipping', verb: string, label: string) {
  pendingMove.value = { section, to, verb, label }
}
const moveOpen = computed({
  get: () => !!pendingMove.value,
  set: (v) => { if (!v) pendingMove.value = null }
})
async function runMove() {
  const m = pendingMove.value
  if (!m) return
  const sel = selections[m.section]
  const res = await bulkTransition(sel.ids(), m.to, m.label)
  pendingMove.value = null
  if (res) sel.clear()
  await Promise.all([refreshConfirmed(), refreshOnHold(), refreshPacked()])
}

// Assign one courier to every selected packed order, one request at a time.
const bulkCompany = ref<string | undefined>(undefined)
const assigningBulk = ref(false)
async function assignSelected() {
  const companyId = bulkCompany.value
  const ids = packedSel.ids()
  if (!companyId || !ids.length) return
  assigningBulk.value = true
  let ok = 0
  const problems: string[] = []
  for (const id of ids) {
    try {
      await api(`/admin/fulfillment/orders/${id}/assign-company`, { method: 'POST', body: { shippingCompanyId: companyId } })
      ok++
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data
      const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message
      problems.push(`#${id.slice(0, 8)}: ${msg ?? 'failed'}`)
    }
  }
  const name = companyOptions.value.find((c) => c.value === companyId)?.label
  if (ok) toast.success(`${ok} order${ok > 1 ? 's' : ''} assigned${name ? ` to ${name}` : ''}`)
  if (problems.length) toast.error(`${problems.length} order${problems.length > 1 ? 's' : ''} could not be assigned`, { description: problems.slice(0, 4).join(' · '), duration: 12000 })
  packedSel.clear()
  bulkCompany.value = undefined
  await refreshPacked()
  assigningBulk.value = false
}

async function markPacked(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'Packed' } }), {
    success: 'Order marked as packed',
    errorFallback: 'Could not mark the order as packed'
  })
  await Promise.all([refreshConfirmed(), refreshPacked()])
  acting.value = null
}

async function putOnHold(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'OnHold' } }), {
    success: 'Order put on hold',
    errorFallback: 'Could not put the order on hold'
  })
  await Promise.all([refreshConfirmed(), refreshOnHold()])
  acting.value = null
}

async function resumeFromHold(orderId: string) {
  acting.value = orderId
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'Confirmed' } }), {
    success: 'Order resumed',
    errorFallback: 'Could not resume the order'
  })
  await Promise.all([refreshConfirmed(), refreshOnHold()])
  acting.value = null
}

async function cancelOnHold(orderId: string) {
  acting.value = orderId
  // CancelledShipping, not Cancelled — this order was already confirmed by
  // call-center, so this is a post-confirmation cancel (see OrderState's
  // Prisma comment / deriveCallCenterState's comment in packages/shared).
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to: 'CancelledShipping' } }), {
    success: 'Order cancelled',
    errorFallback: 'Could not cancel the order'
  })
  await refreshOnHold()
  acting.value = null
}

async function dispatch(orderId: string) {
  acting.value = orderId
  const res = await run(() => api<{ confirmed: boolean; confirmError: string | null }>(`/admin/fulfillment/orders/${orderId}/dispatch`, { method: 'POST', body: { confirm: false } }), {
    errorFallback: 'Could not dispatch the order'
  })
  if (res) toast.success('Sent to the courier — it stays “Prêt à expédier” until you confirm it')
  await Promise.all([refreshPacked(), refreshHandedOver()])
  acting.value = null
}

// Several packed orders at once — grouped by their shipping company, since the
// courier API takes one account per request (100 orders max per request).
async function dispatchSelected() {
  const items = dispatchableSelected.value
  if (!items.length) return
  acting.value = 'bulk'
  const byCompany = new Map<string, string[]>()
  for (const o of items) byCompany.set(o.shippingCompanyId!, [...(byCompany.get(o.shippingCompanyId!) ?? []), o.id])
  let ok = 0
  const problems: string[] = []
  for (const [shippingCompanyId, orderIds] of byCompany) {
    const res = await run(() => api<{ dispatched: { confirmed: boolean }[]; failed: { orderId: string; reason: string }[]; skipped: { orderId: string; reason: string }[] }>('/admin/fulfillment/orders/bulk-dispatch', {
      method: 'POST',
      body: { orderIds, shippingCompanyId, confirm: false }
    }), { errorFallback: 'Bulk dispatch failed' })
    if (!res) continue
    ok += res.dispatched.length
    for (const f of [...res.failed, ...res.skipped]) problems.push(`#${f.orderId.slice(0, 8)}: ${f.reason}`)
  }
  if (ok) toast.success(`${ok} order${ok > 1 ? 's' : ''} sent to the courier`)
  if (problems.length) toast.error(`${problems.length} order${problems.length > 1 ? 's' : ''} not sent`, { description: problems.slice(0, 4).join('\n'), duration: 12000 })
  packedSel.clear()
  await Promise.all([refreshPacked(), refreshHandedOver()])
  acting.value = null
}

// Ramassage (the courier collects) or vers station (we drop it off): no default,
// the person confirming has to choose.
const pickupMode = ref<PickupMode | ''>('')
const pickupOptions = PICKUP_MODES.map((m) => ({ label: m.label, value: m.value }))
const askCollection = computed(() => PICKUP_MODES.find((m) => m.value === pickupMode.value)?.askCollection)

async function confirmParcel(orderId: string) {
  if (askCollection.value === undefined) return toast.error('Choose ramassage or vers station first')
  acting.value = orderId
  await run(() => api(`/admin/fulfillment/orders/${orderId}/request-pickup`, { method: 'POST', body: { askCollection: askCollection.value } }), {
    success: 'Confirmed with the courier',
    errorFallback: 'Could not confirm the parcel'
  })
  await refreshHandedOver()
  acting.value = null
}
// Confirm several parcels with the courier, one request at a time (progress "3 / 12").
const confirmProgress = ref<{ done: number; total: number } | null>(null)
const confirmAllOpen = ref(false)
async function confirmSelected(ids: string[]) {
  if (askCollection.value === undefined) return toast.error('Choose ramassage or vers station first')
  if (!ids.length) return
  acting.value = 'confirm-all'
  confirmProgress.value = { done: 0, total: ids.length }
  let ok = 0
  const problems: string[] = []
  for (const id of ids) {
    try {
      await api(`/admin/fulfillment/orders/${id}/request-pickup`, { method: 'POST', body: { askCollection: askCollection.value } })
      ok++
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data
      const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message
      problems.push(`#${id.slice(0, 8)}: ${msg ?? 'failed'}`)
    }
    confirmProgress.value = { done: confirmProgress.value!.done + 1, total: ids.length }
  }
  if (ok) toast.success(`${ok} parcel${ok > 1 ? 's' : ''} confirmed with the courier`)
  if (problems.length) toast.error(`${problems.length} parcel${problems.length > 1 ? 's' : ''} not confirmed`, { description: problems.slice(0, 4).join(' · '), duration: 12000 })
  labelSelected.value = new Set()
  confirmProgress.value = null
  await refreshHandedOver()
  acting.value = null
}
async function confirmEverything() {
  confirmAllOpen.value = false
  const ids = unconfirmedIds.value
  labelSelected.value = new Set(ids)
  await confirmSelected(ids)
}

// Re-read every active parcel from the couriers now (also runs every 5 minutes).
async function syncCouriers() {
  acting.value = 'sync'
  const res = await run(() => api<{ company: string; checked: number; applied: number; error?: string }[]>('/admin/fulfillment/sync', { method: 'POST' }), { errorFallback: 'Courier sync failed' })
  if (res) {
    const applied = res.reduce((n, r) => n + r.applied, 0)
    const errors = res.filter((r) => r.error)
    if (errors.length) toast.error('Some couriers could not be reached', { description: errors.map((e) => `${e.company}: ${e.error}`).join('\n') })
    else toast.success(applied ? `${applied} status change${applied > 1 ? 's' : ''} applied` : 'Everything is up to date')
  }
  await Promise.all([refreshPacked(), refreshHandedOver()])
  acting.value = null
}

// Manual (in-house) delivery requires a hand-typed tracking reference
// (FulfillmentService.dispatchManual) — that input lives on the order
// detail page, so this queue links there rather than dispatching inline.
</script>

<template>
  <AdsPage title="Fulfillment" :description="`${(confirmed?.total ?? 0) + (packed?.total ?? 0) + (onHold?.total ?? 0) + unconfirmed.length} orders · Pack, hold and dispatch confirmed orders`">
    <template #actions>
      <button class="btn" type="button" :disabled="acting === 'sync'" @click="syncCouriers"><AdsIcon name="i-lucide-refresh-cw" />Sync with couriers</button>
    </template>

    <OrderFilters v-model="filters" :fields="FILTER_FIELDS" />

    <!-- Created at the courier, not confirmed yet -->
    <section v-if="unconfirmed.length" class="card" aria-label="Awaiting courier confirmation">
      <div class="card-head">
        <h2>Awaiting courier confirmation</h2>
        <span class="pill new">{{ unconfirmed.length }}</span>
        <template v-if="!labelSelected.size">
          <AdsSelect v-model="pickupMode" :options="pickupOptions" placeholder="Ramassage or vers station…" aria-label="How the parcels reach the courier" style="min-width: 230px; margin-left: auto" />
          <button class="btn btn-sm btn-primary" type="button" :disabled="acting === 'confirm-all' || !pickupMode" @click="confirmAllOpen = true"><AdsIcon name="i-lucide-package-check" />Confirm all ({{ unconfirmed.length }})</button>
        </template>
      </div>
      <BulkBar :count="labelSelected.size" :busy="acting === 'confirm-all'" @clear="labelSelected = new Set()">
        <button class="btn" type="button" :disabled="printing" @click="printLabels()"><AdsIcon name="i-lucide-printer" />Print {{ labelSelected.size }} label{{ labelSelected.size > 1 ? 's' : '' }}</button>
        <AdsSelect v-model="pickupMode" :options="pickupOptions" placeholder="Ramassage or vers station…" aria-label="How the parcels reach the courier" style="min-width: 230px" />
        <button class="btn btn-primary" type="button" :disabled="acting === 'confirm-all' || !pickupMode" @click="confirmSelected([...labelSelected])"><AdsIcon name="i-lucide-package-check" />{{ confirmProgress ? `${confirmProgress.done} / ${confirmProgress.total}` : `Confirm ${labelSelected.size} with the courier` }}</button>
      </BulkBar>
      <p class="muted" style="padding: 0 20px">These parcels exist at the courier but it will not collect them until they are confirmed.</p>
      <div class="table-wrap">
        <table style="min-width: 860px">
          <thead><tr><th style="width: 32px"><input type="checkbox" aria-label="Select all" :checked="unconfirmed.length > 0 && unconfirmed.every((o) => labelSelected.has(o.id))" @change="toggleAllLabels(unconfirmed.map((o) => o.id))"></th><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th>Courier</th><th>Tracking</th><th class="num">Action</th></tr></thead>
          <tbody>
            <tr v-for="o in unconfirmed" :key="o.id">
              <td><input type="checkbox" :checked="labelSelected.has(o.id)" :aria-label="`Select #${o.id.slice(0, 8)}`" @change="toggleLabel(o.id)"></td>
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td>{{ o.shippingCompanyName }}</td>
              <td class="mono">{{ o.shipment?.trackingReference }}</td>
              <td class="num"><AdsButton size="sm" icon="i-lucide-package-check" :loading="acting === o.id" :disabled="!pickupMode" label="Confirm" :title="pickupMode ? undefined : 'Choose ramassage or vers station above'" @click="confirmParcel(o.id)" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Awaiting packing -->
    <section class="card" aria-label="Awaiting packing">
      <div class="card-head"><h2>Awaiting packing</h2><span class="pill neutral">Confirmed</span></div>
      <BulkBar :count="confSel.count.value" :busy="moving" @clear="confSel.clear()">
        <button class="btn" type="button" :disabled="moving" @click="askMove('confirmed', 'Packed', 'Mark as packed', 'marked as packed')"><AdsIcon name="i-lucide-package-check" />Mark as packed</button>
        <button class="btn" type="button" :disabled="moving" @click="askMove('confirmed', 'OnHold', 'Put on hold', 'put on hold')"><AdsIcon name="i-lucide-pause-circle" />Put on hold</button>
        <button class="btn btn-danger" type="button" :disabled="moving" @click="askMove('confirmed', 'CancelledShipping', 'Cancel shipping', 'shipping cancelled')"><AdsIcon name="i-lucide-x" />Cancel shipping</button>
      </BulkBar>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th style="width: 32px"><input type="checkbox" aria-label="Select all" :checked="confSel.allOf(confirmedIds)" :disabled="!confirmedIds.length" @change="confSel.toggleAll(confirmedIds)"></th><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th class="num">COD</th><th class="num">Action</th></tr></thead>
          <tbody>
            <tr v-if="pendingConfirmed"><td colspan="7" class="empty">Loading…</td></tr>
            <tr v-else-if="!confirmed?.items.length"><td colspan="7" class="empty">Nothing waiting to be packed.</td></tr>
            <tr v-for="o in confirmed?.items" v-else :key="o.id">
              <td><input type="checkbox" :checked="confSel.has(o.id)" :aria-label="`Select #${o.id.slice(0, 8)}`" @change="confSel.toggle(o.id)"></td>
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td class="num"><AdsPrice :amount-cents="o.totalCents" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton appearance="default" size="sm" icon="i-lucide-pause-circle" :loading="acting === o.id" label="Hold" @click="putOnHold(o.id)" />
                <AdsButton size="sm" icon="i-lucide-package-check" style="margin-left: 6px" :loading="acting === o.id" label="Mark packed" @click="markPacked(o.id)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- On hold -->
    <section v-if="onHold?.items.length" class="card" aria-label="On hold">
      <div class="card-head"><h2>On hold</h2></div>
      <BulkBar :count="holdSel.count.value" :busy="moving" @clear="holdSel.clear()">
        <button class="btn" type="button" :disabled="moving" @click="askMove('onHold', 'Confirmed', 'Back to confirmed', 'moved back to confirmed')"><AdsIcon name="i-lucide-play-circle" />Back to confirmed</button>
        <button class="btn" type="button" :disabled="moving" @click="askMove('onHold', 'Packed', 'Mark as packed', 'marked as packed')"><AdsIcon name="i-lucide-package-check" />Mark as packed</button>
        <button class="btn btn-danger" type="button" :disabled="moving" @click="askMove('onHold', 'CancelledShipping', 'Cancel shipping', 'shipping cancelled')"><AdsIcon name="i-lucide-x" />Cancel shipping</button>
      </BulkBar>
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th style="width: 32px"><input type="checkbox" aria-label="Select all" :checked="holdSel.allOf(onHoldIds)" :disabled="!onHoldIds.length" @change="holdSel.toggleAll(onHoldIds)"></th><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th class="num">COD</th><th class="num">Action</th></tr></thead>
          <tbody>
            <tr v-if="pendingOnHold"><td colspan="7" class="empty">Loading…</td></tr>
            <tr v-for="o in onHold?.items" v-else :key="o.id">
              <td><input type="checkbox" :checked="holdSel.has(o.id)" :aria-label="`Select #${o.id.slice(0, 8)}`" @change="holdSel.toggle(o.id)"></td>
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td class="num"><AdsPrice :amount-cents="o.totalCents" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton size="sm" icon="i-lucide-play-circle" :loading="acting === o.id" label="Resume" @click="resumeFromHold(o.id)" />
                <AdsButton appearance="danger" size="sm" icon="i-lucide-x" style="margin-left: 6px" :loading="acting === o.id" label="Cancel" @click="cancelOnHold(o.id)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Ready to dispatch -->
    <section class="card" aria-label="Ready to dispatch">
      <div class="card-head">
        <h2>Ready to dispatch</h2><span class="pill neutral">Packed</span>
        <span v-if="(packed?.total ?? 0) > (packed?.items.length ?? 0)" class="muted" style="font-size: 12px">· showing the first {{ packed?.items.length }} of {{ packed?.total }}</span>
      </div>
      <BulkBar :count="packedSel.count.value" :busy="moving || assigningBulk || acting === 'bulk'" @clear="packedSel.clear()">
        <button class="btn btn-primary" type="button" :disabled="!dispatchableSelected.length || acting === 'bulk' || assigningBulk || moving" :title="dispatchableSelected.length ? undefined : 'None of the selected orders has a courier yet'" @click="dispatchSelected"><AdsIcon name="i-lucide-truck" />Send {{ dispatchableSelected.length }} selected</button>
        <AdsSelect v-if="companyOptions.length" v-model="bulkCompany" :options="companyOptions" placeholder="Courier…" aria-label="Courier to assign" style="min-width: 160px" />
        <button class="btn" type="button" :disabled="!bulkCompany || assigningBulk || moving || acting === 'bulk'" @click="assignSelected"><AdsIcon name="i-lucide-link" />{{ assigningBulk ? 'Assigning…' : 'Assign courier' }}</button>
        <button class="btn" type="button" :disabled="moving || assigningBulk || acting === 'bulk'" @click="askMove('packed', 'Confirmed', 'Back to confirmed', 'moved back to confirmed')"><AdsIcon name="i-lucide-undo-2" />Back to confirmed</button>
      </BulkBar>
      <div class="table-wrap">
        <table style="min-width: 720px">
          <thead><tr><th style="width: 32px"><input type="checkbox" aria-label="Select all" :checked="packedSel.allOf(packedIds)" :disabled="!packedIds.length" @change="packedSel.toggleAll(packedIds)"></th><th>Order</th><th>Products</th><th>Customer</th><th>Destination</th><th>Shipping</th><th class="num">COD</th><th class="num">Action</th></tr></thead>
          <tbody>
            <tr v-if="pendingPacked"><td colspan="8" class="empty">Loading…</td></tr>
            <tr v-else-if="!packed?.items.length"><td colspan="8" class="empty">No orders ready to dispatch.</td></tr>
            <tr v-for="o in packed?.items" v-else :key="o.id">
              <td><input type="checkbox" :checked="packedSel.has(o.id)" :aria-label="`Select #${o.id.slice(0, 8)}`" @change="packedSel.toggle(o.id)"></td>
              <td><NuxtLink :to="`/orders/${o.id}`" class="link-cell">#{{ o.id.slice(0, 8) }}</NuxtLink></td>
              <td><OrderLineItemsInline :items="o.items" compact /></td>
              <td>
                <div>{{ o.customer.name ?? '—' }}</div>
                <div v-if="o.notes" class="note-line" dir="auto">{{ o.notes }}</div>
              </td>
              <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
              <td>
                <AdsSelect v-if="o.fulfillmentMethod === 'Unassigned' && companyOptions.length" :model-value="undefined" :options="companyOptions" placeholder="Assign courier…" :disabled="acting === o.id" style="min-width: 150px" @update:model-value="assignCompany(o.id, $event)" />
                <span v-else-if="o.fulfillmentMethod === 'Unassigned'" class="pill new">Unassigned</span>
                <span v-else-if="o.fulfillmentMethod === 'Manual'" class="pill neutral">Manual</span>
                <span v-else class="pill shipping">{{ o.shippingCompanyName }}</span>
                <div v-if="courierLocs[o.id]?.current" style="margin-top: 4px"><span class="pill neutral">Courier: {{ courierLocs[o.id]!.current!.courierCommune }} ({{ courierLocs[o.id]!.current!.courierWilayaId }})</span></div>
              </td>
              <td class="num"><AdsPrice :amount-cents="o.totalCents" /></td>
              <td class="num" style="white-space: nowrap">
                <AdsButton v-if="o.fulfillmentMethod === 'Unassigned'" appearance="default" size="sm" icon="i-lucide-link" label="Assign" :to="`/orders/${o.id}`" />
                <AdsButton v-else-if="o.fulfillmentMethod === 'Manual'" appearance="default" size="sm" icon="i-lucide-truck" label="Hand to driver" :to="`/orders/${o.id}`" />
                <template v-else>
                  <AdsButton appearance="default" size="sm" icon="i-lucide-map-pinned" label="Convert location" :style="needsConvert(o) ? 'border-color: var(--brass); color: var(--brass)' : undefined" title="Match the customer's wilaya/commune to the courier's list" @click="openConvert(o.id)" />
                  <AdsButton appearance="default" size="sm" icon="i-lucide-package-check" label="Mark as sent" :to="`/orders/${o.id}`" title="Created by hand at the courier? Record it as sent." />
                  <AdsButton size="sm" icon="i-lucide-truck" :loading="acting === o.id" label="Send to courier" @click="dispatch(o.id)" />
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <AdsDialog v-model:open="moveOpen" :title="pendingMove ? `Move ${selections[pendingMove.section].count.value} order${selections[pendingMove.section].count.value > 1 ? 's' : ''}: ${pendingMove.verb}?` : ''" description="Each order is checked on its own; any that cannot move are reported." width="sm">
      <template #footer>
        <button class="btn" type="button" @click="pendingMove = null">Cancel</button>
        <button class="btn" :class="pendingMove?.to === 'CancelledShipping' ? 'btn-danger' : 'btn-primary'" type="button" :disabled="moving" @click="runMove">{{ pendingMove?.verb }}</button>
      </template>
    </AdsDialog>
    <AdsDialog v-model:open="confirmAllOpen" :title="`Confirm all ${unconfirmed.length} parcels with the courier?`" description="The courier will collect every parcel listed here." width="sm">
      <template #footer>
        <button class="btn" type="button" @click="confirmAllOpen = false">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="!pickupMode" @click="confirmEverything">Confirm all</button>
      </template>
    </AdsDialog>
    <ConvertLocationDialog v-if="convertOrderId" v-model:open="convertOpen" :order-id="convertOrderId" @saved="onConverted" />
  </AdsPage>
</template>

<style scoped>
.note-line { margin-top: 2px; max-width: 240px; font-size: 11px; line-height: 1.3; color: var(--text-2); white-space: pre-wrap; }
</style>
