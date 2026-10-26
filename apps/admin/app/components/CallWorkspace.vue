<script setup lang="ts">
import {
  CALL_CENTER_MAX_ATTEMPTS,
  CALL_CENTER_WORK_STATES,
  CANCEL_REASONS,
  MESSAGE_TEMPLATES,
  PRICE_EDITABLE_STATES,
  RISK_FACTOR_LABELS,
  buildSmsUrl,
  buildWhatsAppUrl,
  fillMessageTemplate,
  formatPhoneLocal,
  type AddressCheckResult,
  type AdminOrderListItem,
  type CallAttemptView,
  type CallOutcome,
  type CustomerCallHistory
} from '@amalice/shared'
import { toast } from 'vue-sonner'

// The single "work this order" card shared by the queue page (call-center/
// index.vue) and the drop queue (call-center/drop.vue): customer + phone +
// WhatsApp/SMS, customer history, call timeline, order edits (price, delivery
// details, add item) and the call outcome buttons. Outcomes go through the
// "log a call" endpoint, which records a CallAttempt, so a retry that fails
// again ("no answer" on a no-answer order) and a retry that finally succeeds
// ("confirm" straight from no-answer) both work.
const props = defineProps<{
  order: AdminOrderListItem
  // Keyboard shortcuts (drop queue only: 1-5 outcomes, N note).
  shortcuts?: boolean
  // Show "Skip for now" (drop queue only).
  canSkip?: boolean
}>()
const emit = defineEmits<{
  // A call outcome was recorded — the parent moves on.
  logged: [result: { outcome: CallOutcome; maxAttemptsReached: boolean }]
  // Something on the order changed (price/address/item/note) — the parent refetches it.
  changed: []
  skip: []
}>()

const api = useAdminApi()
const { run } = useApiAction()

// ---- header helpers ----
function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
function ageMinutes(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}
function ageLabel(iso: string) {
  const m = ageMinutes(iso)
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`
}
function ageColor(iso: string): 'success' | 'warning' | 'error' {
  const h = ageMinutes(iso) / 60
  return h < 1 ? 'success' : h < 4 ? 'warning' : 'error'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}
const tierLabel: Record<string, string> = {
  PendingCallCenter: 'New lead',
  CallCenterNoAnswer: 'Retry — no answer',
  Postponed: 'Callback',
  WrongNumber: 'Wrong number',
  Confirmed: 'Confirmed',
  Cancelled: 'Cancelled'
}
const attempts = computed(() => props.order.callAttemptsCount ?? 0)
const maxed = computed(() => attempts.value >= CALL_CENTER_MAX_ATTEMPTS)
const isWorkState = computed(() => CALL_CENTER_WORK_STATES.includes(props.order.state))
// Price / items / recipient stay editable until a courier shipment exists.
const canEdit = computed(() => PRICE_EDITABLE_STATES.includes(props.order.state) && !props.order.shipment)
const itemsEditOpen = ref(false)
const followUpDue = computed(() => props.order.state === 'Postponed' && props.order.postponedUntil && new Date(props.order.postponedUntil) <= new Date())

async function copyPhone() {
  try { await navigator.clipboard.writeText(props.order.customer.phone); toast.success('Number copied') } catch { toast.error('Could not copy') }
}

// ---- WhatsApp / SMS templates ----
const templateId = ref<string>(MESSAGE_TEMPLATES[0].id)
const templateOptions = MESSAGE_TEMPLATES.map((t) => ({ label: t.label, value: t.id }))
function templateText() {
  const t = MESSAGE_TEMPLATES.find((x) => x.id === templateId.value) ?? MESSAGE_TEMPLATES[0]
  return fillMessageTemplate(t.text, {
    name: props.order.customer.name,
    product: props.order.items.map((i) => i.product.name).join(' + '),
    total: `${Math.round(props.order.totalCents / 100).toLocaleString('en')} DA`
  })
}
const whatsappUrl = computed(() => buildWhatsAppUrl(props.order.customer.phone, templateText()))
const smsUrl = computed(() => buildSmsUrl(props.order.customer.phone, templateText()))

// ---- customer history + call timeline (refetched per order) ----
const history = ref<CustomerCallHistory | null>(null)
const calls = ref<CallAttemptView[]>([])
async function loadContext() {
  const id = props.order.id
  const [h, c] = await Promise.all([
    api<CustomerCallHistory>(`/admin/orders/${id}/customer-history`).catch(() => null),
    api<CallAttemptView[]>(`/admin/orders/${id}/calls`).catch(() => [])
  ])
  if (id !== props.order.id) return
  history.value = h
  calls.value = c
}
// ---- address check against the courier's commune list ----
// A commune the courier doesn't recognise is rejected when the parcel is created
// at dispatch time; checking here lets the agent fix it with the customer on the line.
const addressCheck = ref<AddressCheckResult | null>(null)
async function loadAddressCheck() {
  const id = props.order.id
  const res = await api<AddressCheckResult>(`/admin/fulfillment/orders/${id}/address-check`).catch(() => null)
  if (id === props.order.id) addressCheck.value = res
}
async function useCommune(name: string) {
  const res = await run(() => api(`/admin/orders/${props.order.id}/customer-info`, { method: 'PATCH', body: { commune: name } }), {
    success: `Commune set to ${name}`,
    errorFallback: 'Could not update the commune'
  })
  if (res !== undefined) { emit('changed'); loadAddressCheck() }
}
watch(() => [props.order.id, props.order.address.city, props.order.address.region, props.order.shippingType], loadAddressCheck, { immediate: true })

const outcomeLabel: Record<CallOutcome, string> = { Confirmed: 'Confirmed', NoAnswer: 'No answer', WrongNumber: 'Wrong number', Postponed: 'Call back later', Cancelled: 'Cancelled' }
const outcomeColor: Record<CallOutcome, string> = { Confirmed: 'success', NoAnswer: 'warning', WrongNumber: 'error', Postponed: 'info', Cancelled: 'error' }
const reasonLabel = (v: string | null) => CANCEL_REASONS.find((r) => r.value === v)?.label ?? v

// ---- lock heartbeat: keep this order claimed while it's open ----
let heartbeat: ReturnType<typeof setInterval> | undefined
// Only the drop queue claims orders. Merely browsing an order on the queue page
// must never lock it (a locked order is hidden from every other agent's drop),
// and a drop tab left open and idle must let go of its order after a while.
const IDLE_LIMIT_MS = 10 * 60 * 1000
let lastActivity = Date.now()
function markActive() { lastActivity = Date.now() }
async function touch() {
  if (!props.shortcuts || Date.now() - lastActivity > IDLE_LIMIT_MS) return
  try { await api(`/admin/orders/${props.order.id}/lock`, { method: 'POST' }) } catch { /* another agent holds it: surfaced when logging */ }
}

// ---- call note + outcomes ----
const callNote = ref('')
const acting = ref(false)
const anyDialogOpen = computed(() => postponeOpen.value || cancelOpen.value || priceOpen.value || customerOpen.value || addItemOpen.value)

watch(() => props.order.id, () => {
  callNote.value = ''
  history.value = null
  calls.value = []
  loadContext()
  touch()
}, { immediate: true })

async function log(outcome: CallOutcome, extra: { reason?: string; postponedUntil?: string } = {}) {
  if (acting.value) return
  acting.value = true
  const result = await run(
    () => api<{ maxAttemptsReached: boolean }>(`/admin/orders/${props.order.id}/call`, {
      method: 'POST',
      body: { outcome, note: callNote.value.trim() || undefined, ...extra }
    }),
    { success: outcomeLabel[outcome], errorFallback: 'Could not log the call' }
  )
  acting.value = false
  if (!result) return
  if (result.maxAttemptsReached) toast.warning(`Reached ${CALL_CENTER_MAX_ATTEMPTS} attempts without an answer`, { description: 'Consider cancelling or trying another channel (WhatsApp / SMS).' })
  callNote.value = ''
  emit('logged', { outcome, maxAttemptsReached: result.maxAttemptsReached })
}

// ---- postpone ----
const postponeOpen = ref(false)
const postponeDate = ref('')
function toLocalInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function setPostponeIn(hours: number) {
  const d = new Date(Date.now() + hours * 3600 * 1000)
  d.setSeconds(0, 0)
  postponeDate.value = toLocalInput(d)
}
function setPostponeTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  postponeDate.value = toLocalInput(d)
}
function openPostpone() {
  setPostponeIn(4)
  postponeOpen.value = true
}
async function confirmPostpone() {
  if (!postponeDate.value) return
  const iso = new Date(postponeDate.value).toISOString()
  postponeOpen.value = false
  await log('Postponed', { postponedUntil: iso })
}

// ---- cancel (reason required) ----
const cancelOpen = ref(false)
const cancelReason = ref<string | undefined>(undefined)
function openCancel() {
  cancelReason.value = undefined
  cancelOpen.value = true
}
async function confirmCancel() {
  if (!cancelReason.value) return
  cancelOpen.value = false
  await log('Cancelled', { reason: cancelReason.value })
}

// ---- notes (history is appended by the server; this edits the whole text) ----
const notesOpen = ref(false)
const notesText = ref('')
const savingNotes = ref(false)
function openNotes() {
  notesText.value = props.order.notes ?? ''
  notesOpen.value = true
}
async function saveNotes() {
  savingNotes.value = true
  const result = await run(
    () => api(`/admin/orders/${props.order.id}/notes`, { method: 'PATCH', body: { notes: notesText.value.trim() || null } }),
    { success: 'Notes saved', errorFallback: 'Could not save notes' }
  )
  savingNotes.value = false
  if (result !== undefined) { notesOpen.value = false; emit('changed') }
}

// ---- price override ----
const priceOpen = ref(false)
const editTotalDzd = ref<number | null>(null)
const savingPrice = ref(false)
function openPrice() {
  editTotalDzd.value = props.order.totalCents / 100
  priceOpen.value = true
}
async function savePrice() {
  if (editTotalDzd.value == null) return
  const totalCents = Math.round(editTotalDzd.value * 100)
  if (!Number.isFinite(totalCents) || totalCents < 0) { toast.warning('Enter a valid amount'); return }
  if (totalCents === props.order.totalCents) { priceOpen.value = false; return }
  savingPrice.value = true
  const result = await run(() => api(`/admin/orders/${props.order.id}/price`, { method: 'PATCH', body: { totalCents } }), { success: 'Price updated', errorFallback: 'Could not update the price' })
  savingPrice.value = false
  if (result !== undefined) { priceOpen.value = false; emit('changed') }
}

// ---- customer / delivery correction ----
interface WilayaOption { id: string; name: string }
interface CommuneOption { id: string; name: string; wilayaId: string }
const wilayaOptions = ref<WilayaOption[]>([])
const communeOptions = ref<CommuneOption[]>([])
const customerOpen = ref(false)
const editName = ref('')
const editPhone = ref('')
const editWilayaId = ref<string | undefined>(undefined)
const editCommune = ref('')
const editLine1 = ref('')
const editShippingType = ref<'Home' | 'Desk' | undefined>(undefined)
const editDeliveryNote = ref('')
const editFragile = ref(false)
const editGps = ref('')
const savingCustomer = ref(false)
async function loadCommunes(wilayaId: string) {
  communeOptions.value = await api<CommuneOption[]>('/communes', { query: { wilayaId } })
}
async function openCustomer() {
  if (!wilayaOptions.value.length) wilayaOptions.value = await api<WilayaOption[]>('/wilayas')
  const o = props.order
  editName.value = o.customer.name ?? ''
  editPhone.value = formatPhoneLocal(o.customer.phone)
  editLine1.value = o.address.line1
  editCommune.value = o.address.city
  editShippingType.value = o.shippingType ?? undefined
  editDeliveryNote.value = o.deliveryNote ?? ''
  editFragile.value = o.isFragile
  editGps.value = o.gpsLink ?? ''
  editWilayaId.value = wilayaOptions.value.find((w) => w.name === o.address.region)?.id
  if (editWilayaId.value) await loadCommunes(editWilayaId.value)
  customerOpen.value = true
}
watch(editWilayaId, (id, old) => {
  if (id && id !== old) {
    if (old) editCommune.value = ''
    communeOptions.value = []
    loadCommunes(id)
  }
})
async function saveCustomer() {
  const o = props.order
  const wilayaName = wilayaOptions.value.find((w) => w.id === editWilayaId.value)?.name
  if (wilayaName && wilayaName !== o.address.region && !editCommune.value) {
    toast.warning('Choose a commune from the list for the new wilaya')
    return
  }
  const body: Record<string, string> = {}
  if (editName.value.trim() !== (o.customer.name ?? '')) body.customerName = editName.value.trim()
  if (editPhone.value.trim() && editPhone.value.trim() !== formatPhoneLocal(o.customer.phone)) body.customerPhone = editPhone.value.trim()
  if (wilayaName && wilayaName !== o.address.region) body.wilaya = wilayaName
  if (editCommune.value && editCommune.value !== o.address.city) body.commune = editCommune.value
  if (editLine1.value.trim() && editLine1.value.trim() !== o.address.line1) body.addressLine1 = editLine1.value.trim()
  if (editShippingType.value && editShippingType.value !== o.shippingType) body.shippingType = editShippingType.value
  const deliveryChanged = editDeliveryNote.value.trim() !== (o.deliveryNote ?? '') || editFragile.value !== o.isFragile || editGps.value.trim() !== (o.gpsLink ?? '')
  if (!Object.keys(body).length && !deliveryChanged) { customerOpen.value = false; return }
  savingCustomer.value = true
  let result: unknown = true
  if (Object.keys(body).length) {
    result = await run(() => api(`/admin/orders/${o.id}/customer-info`, { method: 'PATCH', body }), { errorFallback: 'Could not update customer info' })
  }
  if (result !== undefined && deliveryChanged) {
    result = await run(() => api(`/admin/fulfillment/orders/${o.id}/delivery-info`, {
      method: 'PATCH',
      body: { deliveryNote: editDeliveryNote.value.trim() || null, isFragile: editFragile.value, gpsLink: editGps.value.trim() || null }
    }), { errorFallback: 'Could not update the delivery details' })
  }
  savingCustomer.value = false
  if (result !== undefined) { toast.success('Customer info updated'); customerOpen.value = false; emit('changed'); loadContext(); loadAddressCheck() }
}

// ---- add item (upsell during the call) ----
interface ProductOption { id: string; name: string; slug: string; priceCents: number }
interface VariantOption { id: string; priceCents: number; attributes: Record<string, string> }
const addItemOpen = ref(false)
const productOptions = ref<ProductOption[]>([])
const addProductId = ref<string | undefined>(undefined)
const addVariantId = ref<string | undefined>(undefined)
const addVariants = ref<VariantOption[]>([])
const addQty = ref(1)
const addPriceDzd = ref<number | null>(null)
const addingItem = ref(false)
async function openAddItem() {
  addProductId.value = undefined
  addVariantId.value = undefined
  addVariants.value = []
  addQty.value = 1
  addPriceDzd.value = null
  addItemOpen.value = true
  if (!productOptions.value.length) productOptions.value = (await api<{ items: ProductOption[] }>('/admin/products?pageSize=100')).items
}
watch(addProductId, async (id) => {
  addVariantId.value = undefined
  addVariants.value = []
  const p = productOptions.value.find((x) => x.id === id)
  if (p) addVariants.value = (await api<{ variants: VariantOption[] }>(`/products/${p.slug}`)).variants
})
async function submitAddItem() {
  if (!addProductId.value) { toast.warning('Pick a product'); return }
  addingItem.value = true
  const result = await run(
    () => api(`/admin/orders/${props.order.id}/items`, {
      method: 'POST',
      body: {
        productId: addProductId.value,
        variantId: addVariantId.value,
        quantity: addQty.value,
        priceCentsOverride: addPriceDzd.value == null ? undefined : Math.round(addPriceDzd.value * 100),
        isUpsell: true
      }
    }),
    { success: 'Item added (upsell)', errorFallback: 'Could not add the item' }
  )
  addingItem.value = false
  if (result !== undefined) { addItemOpen.value = false; emit('changed') }
}

// ---- keyboard shortcuts ----
function isTyping() {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
function onKeydown(e: KeyboardEvent) {
  if (!props.shortcuts || isTyping() || acting.value || anyDialogOpen.value || e.ctrlKey || e.metaKey || e.altKey) return
  switch (e.key) {
    case '1': log('Confirmed'); break
    case '2': log('NoAnswer'); break
    case '3': log('WrongNumber'); break
    case '4': openPostpone(); break
    case '5': openCancel(); break
    case 's': case 'S': if (props.canSkip) emit('skip'); break
    case 'n': case 'N': e.preventDefault(); document.getElementById('call-note')?.focus(); break
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  for (const ev of ['keydown', 'click', 'pointermove', 'touchstart']) window.addEventListener(ev, markActive, { passive: true })
  heartbeat = setInterval(touch, 2 * 60 * 1000)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  for (const ev of ['keydown', 'click', 'pointermove', 'touchstart']) window.removeEventListener(ev, markActive)
  if (heartbeat) clearInterval(heartbeat)
})
</script>

<template>
  <section class="card" aria-label="Current call">
    <div v-if="order.riskLevel && order.riskLevel !== 'Low'" class="notice" :class="order.riskLevel === 'High' ? 'danger' : 'warn'">
      <AdsIcon name="i-lucide-shield-alert" />
      <span>
        <strong>{{ order.riskLevel }} return risk ({{ order.riskScore }}/100).</strong>
        {{ (order.riskFactors ?? []).filter((f) => f.points > 0).map((f) => RISK_FACTOR_LABELS[f.code] ?? f.code).join(' · ') }}
        <NuxtLink :to="`/orders/${order.id}`">Details</NuxtLink>
      </span>
    </div>
    <div v-if="order.isDuplicate" class="notice danger"><AdsIcon name="i-lucide-alert-triangle" /><span>Possible duplicate: same customer and product within the last 2 days<template v-if="order.duplicateOfOrderId"> — <NuxtLink :to="`/orders/${order.duplicateOfOrderId}`">see the earlier order</NuxtLink></template>.</span></div>
    <div v-if="addressCheck && addressCheck.checked && !addressCheck.ok" class="notice danger">
      <AdsIcon name="i-lucide-alert-triangle" />
      <span>
        <template v-for="(issue, i) in addressCheck.issues" :key="i">{{ issue }} </template>
        <span v-if="addressCheck.suggestions.length" style="display: block; margin-top: 6px">
          Confirm the right commune with the customer:
          <button v-for="c in addressCheck.suggestions" :key="c" class="btn btn-sm" type="button" style="margin: 2px 4px 2px 0" @click="useCommune(c)">{{ c }}</button>
        </span>
      </span>
    </div>
    <div v-if="maxed" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ attempts }} attempts without confirmation. Try WhatsApp / SMS, or cancel with a reason.</span></div>
    <div v-if="followUpDue" class="notice warn"><AdsIcon name="i-lucide-clock" /><span>The customer asked to be called back at {{ fmtDate(order.postponedUntil!) }}.</span></div>
    <div v-else-if="order.state === 'Postponed' && order.postponedUntil" class="notice"><AdsIcon name="i-lucide-clock" /><span>Callback scheduled for {{ fmtDate(order.postponedUntil) }}.</span></div>

    <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px">
      <div style="min-width: 0; flex: 1 1 280px">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
          <NuxtLink :to="`/orders/${order.id}`" class="link-cell">#{{ order.id.slice(0, 8) }}</NuxtLink>
          <span class="pill neutral">{{ tierLabel[order.state] ?? order.state }}</span>
          <span v-if="order.fromAbandoned || order.isAbandoned" class="pill outline" title="Customer never finished submitting the form.">Abandoned cart</span>
          <span v-if="attempts" class="pill returned">Attempt {{ attempts + 1 }}</span>
          <AdsBadge :color="ageColor(order.createdAt)" variant="subtle">waiting {{ ageLabel(order.createdAt) }}</AdsBadge>
        </div>
        <h2 style="font-size: 20px; margin-top: 8px">{{ order.customer.name ?? 'No name given' }}</h2>
        <a :href="`tel:${order.customer.phone}`" class="phone-big mono" style="display: inline-flex; align-items: center; gap: 8px; color: var(--pine); text-decoration: none">
          <AdsIcon name="i-lucide-phone-call" style="width: 18px; height: 18px" />{{ formatPhoneLocal(order.customer.phone) }}
        </a>
        <p class="muted" style="margin-top: 4px">
          {{ order.address.line1 }}, {{ order.address.city }}, {{ order.address.region }}
          · {{ order.shippingType === 'Home' ? 'Home delivery' : order.shippingType === 'Desk' ? 'Stop desk' : 'No delivery type' }}
          <button v-if="canEdit" class="btn btn-primary btn-sm" type="button" style="margin-inline-start: 6px" @click="openCustomer"><AdsIcon name="i-lucide-pencil" />Edit info</button>
        </p>
      </div>
      <div style="text-align: right">
        <AdsPrice :amount-cents="order.totalCents" class="strong" style="font-size: 22px" />
        <div class="muted" style="font-size: 12px">incl. delivery <AdsPrice :amount-cents="order.shippingPriceCents" /></div>
        <button v-if="canEdit" class="btn btn-primary btn-sm" type="button" @click="openPrice"><AdsIcon name="i-lucide-pencil" />Edit price</button>
      </div>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center">
      <a class="btn btn-primary" :href="`tel:${order.customer.phone}`"><AdsIcon name="i-lucide-phone-call" />Call now</a>
      <button class="btn" type="button" @click="copyPhone"><AdsIcon name="i-lucide-copy" />Copy</button>
      <AdsSelect v-model="templateId" :options="templateOptions" size="sm" style="width: 190px" aria-label="Message template" />
      <a class="btn" :href="whatsappUrl" target="_blank" rel="noopener"><AdsIcon name="i-lucide-message-circle" />WhatsApp</a>
      <a class="btn" :href="smsUrl"><AdsIcon name="i-lucide-send" />SMS</a>
    </div>

    <!-- Customer history -->
    <div v-if="history && history.totalOrders" class="notice" :class="{ warn: history.returned + history.cancelled >= 2 }">
      <AdsIcon name="i-lucide-user-check" />
      <span>
        Returning customer: {{ history.totalOrders }} previous order{{ history.totalOrders > 1 ? 's' : '' }} —
        {{ history.delivered }} delivered, {{ history.returned }} returned, {{ history.cancelled }} cancelled<template v-if="history.inProgress">, {{ history.inProgress }} in progress</template>.
      </span>
    </div>
    <div v-else-if="history" class="muted" style="font-size: 12px">First order from this customer.</div>

    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
        <h3 style="font-size: 14px">Order</h3>
        <div v-if="canEdit" style="display: flex; gap: 8px">
          <button class="btn btn-primary btn-sm" type="button" @click="itemsEditOpen = true"><AdsIcon name="i-lucide-pencil" />Edit items</button>
          <button class="btn btn-sm" type="button" @click="openAddItem"><AdsIcon name="i-lucide-plus" />Add item (upsell)</button>
        </div>
      </div>
      <OrderLineItemsInline :items="order.items" />
    </div>

    <!-- Notes + call timeline -->
    <div class="grid-2" style="align-items: start">
      <div class="stack" style="gap: 6px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <h3 style="font-size: 14px">Notes</h3>
          <button class="btn btn-primary btn-sm" type="button" @click="openNotes"><AdsIcon name="i-lucide-sticky-note" />{{ order.notes ? 'Edit note' : 'Add note' }}</button>
        </div>
        <p v-if="order.notes" style="white-space: pre-wrap; font-size: 13px">{{ order.notes }}</p>
        <p v-else class="muted" style="font-size: 13px">No notes yet.</p>
      </div>
      <div class="stack" style="gap: 6px">
        <h3 style="font-size: 14px">Call history</h3>
        <p v-if="!calls.length" class="muted" style="font-size: 13px">No calls logged yet.</p>
        <ul v-else class="stack" style="gap: 6px; list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto">
          <li v-for="c in calls" :key="c.id" style="font-size: 13px">
            <AdsBadge :color="outcomeColor[c.outcome] as any" variant="subtle">{{ outcomeLabel[c.outcome] }}</AdsBadge>
            <span class="muted"> {{ fmtDate(c.createdAt) }} · {{ c.agentEmail?.split('@')[0] ?? '—' }}</span>
            <span v-if="c.reason" class="muted"> · {{ reasonLabel(c.reason) }}</span>
            <span v-if="c.note" style="display: block">{{ c.note }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="!isWorkState" class="notice"><AdsIcon name="i-lucide-info" /><span>This order is <b>{{ tierLabel[order.state] ?? order.state }}</b>: it is no longer in the call queue. <NuxtLink :to="`/orders/${order.id}`">Open the order page</NuxtLink> to follow it.</span></div>
    <div v-if="isWorkState" class="field">
      <label class="label" for="call-note">Call note <span v-if="shortcuts" class="muted">(N)</span></label>
      <input id="call-note" v-model="callNote" class="input" maxlength="500" placeholder="e.g. Wants delivery after 17:00">
    </div>

    <AdsButton v-if="isWorkState" icon="i-lucide-check" block :loading="acting" label="Confirm order" @click="log('Confirmed')" />
    <div v-if="isWorkState" class="outcomes" role="group" aria-label="Call result" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))">
      <button class="outcome" type="button" :disabled="acting" @click="log('NoAnswer')"><AdsIcon name="i-lucide-phone-missed" />No answer</button>
      <button class="outcome" type="button" :disabled="acting" @click="log('WrongNumber')"><AdsIcon name="i-lucide-phone-off" />Wrong number</button>
      <button class="outcome" type="button" :disabled="acting" @click="openPostpone"><AdsIcon name="i-lucide-calendar-clock" />Call back later</button>
      <button class="outcome bad" type="button" :disabled="acting" @click="openCancel"><AdsIcon name="i-lucide-x" />Cancel</button>
    </div>
    <div v-if="canSkip && isWorkState" style="display: flex; flex-wrap: wrap; gap: 8px">
      <button class="btn btn-sm" type="button" @click="emit('skip')"><AdsIcon name="i-lucide-skip-forward" />Skip for now</button>
    </div>
  </section>

  <AdsDialog v-model:open="postponeOpen" title="Call back later" description="The order leaves the queue until this time, then comes back at the top." width="sm">
    <div style="display: flex; flex-wrap: wrap; gap: 6px">
      <button class="btn btn-sm" type="button" @click="setPostponeIn(1)">In 1 h</button>
      <button class="btn btn-sm" type="button" @click="setPostponeIn(3)">In 3 h</button>
      <button class="btn btn-sm" type="button" @click="setPostponeTomorrow">Tomorrow 10:00</button>
    </div>
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="postponeOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!postponeDate" @click="confirmPostpone">Schedule callback</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="cancelOpen" title="Cancel this order" description="Pick the reason — it feeds the cancellation report." width="sm">
    <AdsField label="Reason"><AdsSelect v-model="cancelReason" :options="CANCEL_REASONS.map((r) => ({ label: r.label, value: r.value }))" placeholder="Choose a reason…" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="cancelOpen = false">Back</button>
      <button class="btn btn-primary" type="button" :disabled="!cancelReason" @click="confirmCancel">Cancel order</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="notesOpen" title="Order notes" width="sm">
    <AdsTextarea v-model="notesText" :rows="6" placeholder="Notes for this order…" />
    <template #footer>
      <button class="btn" type="button" @click="notesOpen = false">Cancel</button>
      <AdsButton :loading="savingNotes" icon="i-lucide-check" @click="saveNotes">Save</AdsButton>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="priceOpen" title="Edit final price" description="Available until the order is sent to the courier." width="sm">
    <AdsField label="Final price to collect (DZD)" :help="`Shipping stays ${order.shippingPriceCents / 100} DZD; the product price absorbs the change.`"><AdsNumberInput v-model="editTotalDzd" :min="0" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="priceOpen = false">Cancel</button>
      <AdsButton :loading="savingPrice" icon="i-lucide-check" @click="savePrice">Save</AdsButton>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="customerOpen" title="Edit customer / delivery info">
    <div class="grid-2">
      <AdsField label="Name"><AdsInput v-model="editName" /></AdsField>
      <AdsField label="Phone"><AdsInput v-model="editPhone" /></AdsField>
    </div>
    <div class="grid-2">
      <AdsField label="Wilaya"><AdsSearchSelect v-model="editWilayaId" :options="wilayaOptions.map((w) => ({ label: w.name, value: w.id }))" placeholder="Search a wilaya…" /></AdsField>
      <AdsField label="Commune"><AdsSearchSelect v-model="editCommune" :options="communeOptions.map((c) => ({ label: c.name, value: c.name }))" :placeholder="editWilayaId ? 'Search a commune…' : 'Choose a wilaya first'" :disabled="!editWilayaId" /></AdsField>
    </div>
    <AdsField label="Address line"><AdsInput v-model="editLine1" /></AdsField>
    <AdsField label="Shipping method">
      <AdsRadioGroup v-model="editShippingType" orientation="horizontal" :items="[{ label: 'Home delivery', value: 'Home' }, { label: 'Desk pickup', value: 'Desk' }]" />
    </AdsField>
    <AdsField label="Remark for the courier" help="Instructions the driver sees, e.g. “call before arriving”."><AdsInput v-model="editDeliveryNote" maxlength="255" /></AdsField>
    <div class="grid-2">
      <AdsField label="Customer location (GPS link)"><AdsInput v-model="editGps" placeholder="https://maps.google.com/…" /></AdsField>
      <label class="check" style="align-self: end"><input v-model="editFragile" type="checkbox">Fragile parcel</label>
    </div>
    <template #footer>
      <button class="btn" type="button" @click="customerOpen = false">Cancel</button>
      <AdsButton :loading="savingCustomer" icon="i-lucide-check" @click="saveCustomer">Save</AdsButton>
    </template>
  </AdsDialog>

  <OrderItemsEditor v-model:open="itemsEditOpen" :order-id="order.id" :items="order.items" @changed="emit('changed')" />

  <AdsDialog v-model:open="addItemOpen" title="Add item to order" description="Upsell during the call. The total updates automatically.">
    <AdsField label="Product"><AdsSelect v-model="addProductId" :options="productOptions.map((p) => ({ label: p.name, value: p.id }))" placeholder="Choose a product…" /></AdsField>
    <AdsField v-if="addVariants.length" label="Variant"><AdsSelect v-model="addVariantId" :options="addVariants.map((v) => ({ label: Object.values(v.attributes).join(' / '), value: v.id }))" placeholder="Choose a variant…" /></AdsField>
    <div class="grid-2">
      <AdsField label="Quantity"><AdsNumberInput v-model="addQty" :min="1" /></AdsField>
      <AdsField label="Price override (DZD)" help="Blank = normal price"><AdsNumberInput v-model="addPriceDzd" :min="0" /></AdsField>
    </div>
    <template #footer>
      <button class="btn" type="button" @click="addItemOpen = false">Cancel</button>
      <AdsButton :loading="addingItem" icon="i-lucide-plus" @click="submitAddItem">Add item</AdsButton>
    </template>
  </AdsDialog>
</template>
