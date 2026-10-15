<script setup lang="ts">
import { formatPhoneLocal, type OrderListResponse } from '@amalice/shared'
import { toast } from 'vue-sonner'

// Stage 1 of the order pipeline: a human agent calls the customer to confirm
// a real order before anything gets picked. Two queues, same as
// fulfillment/index.vue's "packed vs in transit" split — the main queue
// (never called yet / awaiting a call) and the retry queue (called, no
// answer, needs a follow-up attempt).
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] })
useHead({ title: 'Call Center' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: pendingQueue, pending, refresh: refreshPending } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=PendingCallCenter&pageSize=50',
  { key: 'admin-call-center-pending' }
)
const { data: noAnswerQueue, refresh: refreshNoAnswer } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=CallCenterNoAnswer&pageSize=50',
  { key: 'admin-call-center-no-answer' }
)
// Wrong number / postponed — two more call-center outcomes that aren't
// "no answer" (see OrderState's Prisma comment): a bad number needs a
// corrected number before retrying, not just another call; a postponed
// customer asked to be contacted later, so it shouldn't get swept back
// into the main retry queue immediately.
const { data: wrongNumberQueue, refresh: refreshWrongNumber } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=WrongNumber&pageSize=50',
  { key: 'admin-call-center-wrong-number' }
)
const { data: postponedQueue, refresh: refreshPostponed } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=Postponed&pageSize=50',
  { key: 'admin-call-center-postponed' }
)

const acting = ref<string | null>(null)
const actionLabel: Record<string, string> = {
  Confirmed: 'Order confirmed',
  CallCenterNoAnswer: 'Marked as no answer',
  WrongNumber: 'Marked as wrong number',
  Postponed: 'Order postponed',
  PendingCallCenter: 'Moved back to the call queue',
  Cancelled: 'Order cancelled'
}
async function act(orderId: string, to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'PendingCallCenter' | 'Cancelled', postponedUntil?: string) {
  acting.value = `${orderId}:${to}`
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to, postponedUntil } }), {
    success: actionLabel[to],
    errorFallback: 'Could not update the order'
  })
  await Promise.all([refreshPending(), refreshNoAnswer(), refreshWrongNumber(), refreshPostponed()])
  acting.value = null
}

// ---- Postpone requires a follow-up date/time (server now rejects a bare
// `{to: 'Postponed'}` — see TransitionOrderSchema's refine in packages/shared).
const postponeModalOpen = ref(false)
const postponeOrderId = ref<string | null>(null)
const postponeDate = ref('')

function openPostpone(orderId: string) {
  postponeOrderId.value = orderId
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000)
  d.setSeconds(0, 0)
  postponeDate.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  postponeModalOpen.value = true
}

async function confirmPostpone() {
  if (!postponeOrderId.value || !postponeDate.value) return
  const iso = new Date(postponeDate.value).toISOString()
  postponeModalOpen.value = false
  await act(postponeOrderId.value, 'Postponed', iso)
}

// ---- Call-center notes — free text per order, mirrored into the Google
// Sheets integration's Notes column (see GoogleSheetsService.updateNotes)
// so both places stay in sync regardless of which one an agent edits.
const notesModalOpen = ref(false)
const notesOrderId = ref<string | null>(null)
const notesText = ref('')
const savingNotes = ref(false)

function openNotes(order: { id: string; notes: string | null }) {
  notesOrderId.value = order.id
  notesText.value = order.notes ?? ''
  notesModalOpen.value = true
}

async function saveNotes() {
  if (!notesOrderId.value) return
  savingNotes.value = true
  const result = await run(
    () => api(`/admin/orders/${notesOrderId.value}/notes`, { method: 'PATCH', body: { notes: notesText.value.trim() || null } }),
    { success: 'Notes saved', errorFallback: 'Could not save notes' }
  )
  savingNotes.value = false
  if (result !== undefined) {
    notesModalOpen.value = false
    await Promise.all([refreshPending(), refreshNoAnswer(), refreshWrongNumber(), refreshPostponed()])
  }
}

// ---- Call-center price override (ADM-12) — shipping fee and/or total,
// only legal while the order is still in one of these 4 pre-confirmation
// queues; the button is safe to show unconditionally here since every order
// on this page already qualifies. Server re-enforces regardless.
const priceModalOpen = ref(false)
const priceOrderId = ref<string | null>(null)
const editShippingDzd = ref<number | null>(null)
const editTotalDzd = ref<number | null>(null)
const savingPrice = ref(false)

function openPriceEditor(order: { id: string; shippingPriceCents: number; totalCents: number }) {
  priceOrderId.value = order.id
  editShippingDzd.value = order.shippingPriceCents / 100
  editTotalDzd.value = order.totalCents / 100
  priceModalOpen.value = true
}

async function savePrice() {
  if (!priceOrderId.value || editShippingDzd.value == null || editTotalDzd.value == null) return
  savingPrice.value = true
  const result = await run(
    () => api(`/admin/orders/${priceOrderId.value}/price`, {
      method: 'PATCH',
      body: { shippingPriceCents: Math.round(editShippingDzd.value! * 100), totalCents: Math.round(editTotalDzd.value! * 100) }
    }),
    { success: 'Price updated', errorFallback: 'Could not update the price' }
  )
  savingPrice.value = false
  if (result !== undefined) {
    priceModalOpen.value = false
    await Promise.all([refreshPending(), refreshNoAnswer(), refreshWrongNumber(), refreshPostponed()])
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function addressLine(o: { address: { line1: string; city: string; region: string } }) {
  return `${o.address.line1}, ${o.address.city}, ${o.address.region}`
}
// ---- Design workspace: one queue tab at a time, one order selected, call outcomes as buttons ----
type QueueState = 'PendingCallCenter' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed'
const tab = ref<QueueState>('PendingCallCenter')
const queues = computed<Record<QueueState, OrderListResponse['items']>>(() => ({
  PendingCallCenter: pendingQueue.value?.items ?? [],
  CallCenterNoAnswer: noAnswerQueue.value?.items ?? [],
  WrongNumber: wrongNumberQueue.value?.items ?? [],
  Postponed: postponedQueue.value?.items ?? []
}))
const counts = computed(() => ({
  PendingCallCenter: pendingQueue.value?.total ?? queues.value.PendingCallCenter.length,
  CallCenterNoAnswer: noAnswerQueue.value?.total ?? queues.value.CallCenterNoAnswer.length,
  WrongNumber: wrongNumberQueue.value?.total ?? queues.value.WrongNumber.length,
  Postponed: postponedQueue.value?.total ?? queues.value.Postponed.length
}))
const tabs = computed(() => [
  { label: 'Waiting', value: 'PendingCallCenter', count: counts.value.PendingCallCenter },
  { label: 'No answer', value: 'CallCenterNoAnswer', count: counts.value.CallCenterNoAnswer },
  { label: 'Wrong number', value: 'WrongNumber', count: counts.value.WrongNumber },
  { label: 'Postponed', value: 'Postponed', count: counts.value.Postponed }
])
const list = computed(() => queues.value[tab.value])
const selectedId = ref<string | null>(null)
watch([list, tab], () => {
  if (!list.value.some((o) => o.id === selectedId.value)) selectedId.value = list.value[0]?.id ?? null
}, { immediate: true })
const current = computed(() => list.value.find((o) => o.id === selectedId.value) ?? null)
const callNote = ref('')
watch(current, (o) => { callNote.value = '' }, { immediate: true })

function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
function waited(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}
async function copyPhone(phone: string) {
  try { await navigator.clipboard.writeText(phone); toast.success('Number copied') } catch { toast.error('Could not copy') }
}
// A typed call note is saved with the outcome (mirrored to the Google Sheets Notes column).
async function outcome(to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Cancelled' | 'PendingCallCenter') {
  const o = current.value
  if (!o) return
  const note = callNote.value.trim()
  if (note && note !== (o.notes ?? '')) {
    await run(() => api(`/admin/orders/${o.id}/notes`, { method: 'PATCH', body: { notes: note } }), { errorFallback: 'Could not save the call note' })
  }
  await act(o.id, to)
}

</script>

<template>
  <AdsPage title="Call center" description="Orders waiting for phone confirmation">
    <template #actions>
      <NuxtLink to="/call-center/drop" class="btn"><AdsIcon name="i-lucide-zap" />Drop queue</NuxtLink>
    </template>

    <section class="kpis" aria-label="Queues">
      <AdsKpiCard label="Waiting for a call" :value="counts.PendingCallCenter" color="dark" :meta="pendingQueue?.items.length ? `Oldest: ${waited(pendingQueue.items[pendingQueue.items.length - 1]!.createdAt)}` : 'Queue is clear'" />
      <AdsKpiCard label="No answer" :value="counts.CallCenterNoAnswer" meta="Retry later" />
      <AdsKpiCard label="Wrong number" :value="counts.WrongNumber" color="error" meta="Needs a corrected number" />
      <AdsKpiCard label="Postponed" :value="counts.Postponed" color="warning" meta="Customer asked for a later call" />
    </section>

    <div class="split queue-left">
      <section class="card flush" aria-labelledby="q-h">
        <div class="card-head"><h2 id="q-h">Queue <small>{{ list.length }} orders</small></h2></div>
        <div style="padding: 10px 12px; border-bottom: 1px solid var(--line-soft)">
          <AdsTabs v-model="tab" :items="tabs" />
        </div>
        <div v-if="pending" class="empty">Loading…</div>
        <div v-else-if="!list.length" class="empty">Nothing here. Good job.</div>
        <div v-else class="queue" role="list">
          <button v-for="o in list" :key="o.id" type="button" class="queue-item" role="listitem" :aria-current="o.id === selectedId" @click="selectedId = o.id">
            <span class="initials">{{ initials(o.customer.name) }}</span>
            <span class="meta">
              <b>{{ o.customer.name ?? o.customer.phone }}</b>
              <span>#{{ o.id.slice(0, 8) }} · {{ o.address.region }} · <AdsPrice :amount-cents="o.totalCents" /></span>
              <span>{{ o.notes ?? 'No call note' }}</span>
            </span>
            <span class="side"><span class="muted">{{ waited(o.createdAt) }}</span><span v-if="o.isDuplicate" class="pill returned">Duplicate?</span></span>
          </button>
        </div>
      </section>

      <section class="card" aria-label="Current call">
        <div v-if="!current" class="empty" style="padding: 60px 20px">
          <AdsIcon name="i-lucide-check" style="width: 32px; height: 32px; color: var(--teal); display: block; margin: 0 auto" />
          <h2 style="font-size: 18px; margin-top: 10px; color: var(--pine)">Queue is empty</h2>
          <p>Every order in this tab has been called.</p>
        </div>

        <template v-else>
          <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap">
            <span class="initials lg">{{ initials(current.customer.name) }}</span>
            <div class="grow">
              <h2 style="font-size: 20px">{{ current.customer.name ?? 'No name given' }}</h2>
              <span class="muted">Order <NuxtLink :to="`/orders/${current.id}`">#{{ current.id.slice(0, 8) }}</NuxtLink> · {{ fmtDate(current.createdAt) }}</span>
            </div>
            <div style="text-align: right"><div class="phone-big mono">{{ formatPhoneLocal(current.customer.phone) }}</div><span class="muted">{{ current.address.region }}</span></div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <a class="btn btn-primary" :href="`tel:${current.customer.phone}`"><AdsIcon name="i-lucide-phone-call" />Call now</a>
            <button class="btn" type="button" @click="copyPhone(current.customer.phone)"><AdsIcon name="i-lucide-copy" />Copy number</button>
            <button class="btn" type="button" @click="openPriceEditor(current)"><AdsIcon name="i-lucide-pencil" />Edit price</button>
          </div>

          <div v-if="current.isDuplicate" class="notice warn"><AdsIcon name="i-lucide-copy-x" /><span>Possible duplicate: same customer and product within the last 2 days.</span></div>
          <div v-if="current.notes" class="notice warn"><AdsIcon name="i-lucide-sticky-note" /><span>{{ current.notes }}</span></div>

          <div class="grid-2" style="align-items: start">
            <div class="stack" style="gap: 12px">
              <h3 style="font-size: 14px">Order</h3>
              <div class="stack" style="gap: 10px">
                <div v-for="it in current.items" :key="it.id" class="prod">
                  <span class="thumb"><AdsIcon name="i-lucide-package" /></span>
                  <span class="grow">{{ it.product.name }}<span class="muted" style="display: block; font-size: 12px">{{ it.variantLabel ?? 'Default' }} · <AdsPrice :amount-cents="it.unitPriceCents" /></span></span>
                  <b>× {{ it.quantity }}</b>
                </div>
              </div>
              <div class="totals">
                <div><span>Delivery<template v-if="current.shippingType"> ({{ current.shippingType === 'Home' ? 'Home' : 'Stop desk' }})</template></span><span><AdsPrice :amount-cents="current.shippingPriceCents" /></span></div>
                <div class="grand"><span>To collect</span><span><AdsPrice :amount-cents="current.totalCents" /></span></div>
              </div>
            </div>
            <div class="stack" style="gap: 12px">
              <h3 style="font-size: 14px">Check the delivery details</h3>
              <dl class="details">
                <dt>Wilaya</dt><dd>{{ current.address.region }}</dd>
                <dt>Commune</dt><dd>{{ current.address.city }}</dd>
                <dt>Address</dt><dd>{{ current.address.line1 }}</dd>
                <dt>Delivery</dt><dd>{{ current.shippingType === 'Home' ? 'Home' : current.shippingType === 'Desk' ? 'Stop desk' : '—' }}</dd>
              </dl>
              <NuxtLink :to="`/orders/${current.id}`" class="btn btn-sm" style="align-self: flex-start"><AdsIcon name="i-lucide-pencil" />Edit in the order page</NuxtLink>
            </div>
          </div>

          <div class="field"><label class="label" for="ws-note">Call note</label><input id="ws-note" v-model="callNote" class="input" placeholder="e.g. Wants delivery after 17:00"></div>
          <div class="outcomes" role="group" aria-label="Call result" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))">
            <button class="outcome ok" type="button" :disabled="!!acting" @click="outcome('Confirmed')"><AdsIcon name="i-lucide-check" />Confirmed</button>
            <button class="outcome" type="button" :disabled="!!acting" @click="outcome('CallCenterNoAnswer')"><AdsIcon name="i-lucide-phone-missed" />No answer</button>
            <button class="outcome" type="button" :disabled="!!acting" @click="openPostpone(current.id)"><AdsIcon name="i-lucide-clock" />Call back later</button>
            <button class="outcome" type="button" :disabled="!!acting" @click="outcome('WrongNumber')"><AdsIcon name="i-lucide-phone-off" />Wrong number</button>
            <button class="outcome bad" type="button" :disabled="!!acting" @click="outcome('Cancelled')"><AdsIcon name="i-lucide-x" />Cancelled</button>
          </div>
          <button v-if="tab !== 'PendingCallCenter'" class="btn btn-sm" type="button" style="align-self: flex-start" :disabled="!!acting" @click="outcome('PendingCallCenter')">Move back to the call queue</button>
        </template>
      </section>
    </div>
  </AdsPage>

  <AdsDialog v-model:open="postponeModalOpen" title="Call back later" description="The order stays out of the queues until this date/time is reached." width="sm">
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="postponeModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!postponeDate" @click="confirmPostpone">Postpone</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="priceModalOpen" title="Edit price / shipping fee" description="Call-center negotiation window: only before the order is confirmed." width="sm">
    <AdsField label="Shipping fee (DZD)"><AdsNumberInput v-model="editShippingDzd" :min="0" /></AdsField>
    <AdsField label="Total due, COD (DZD)"><AdsNumberInput v-model="editTotalDzd" :min="0" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="priceModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="savingPrice" @click="savePrice">Save</button>
    </template>
  </AdsDialog>
</template>
