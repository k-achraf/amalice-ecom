<script setup lang="ts">
import { formatPhoneLocal, type AdminOrderListItem } from '@amalice/shared'

// ADM-11 — Call Center "Drop Queue": a single-order-at-a-time power-dialer
// view. Instead of an agent scanning 4 separate lists (call-center/index.vue)
// and picking what to work next, the server hands back one priority-ranked
// list (GET /admin/orders/drop-queue — see AdminOrdersService.dropQueue for
// the ranking rules) and this page just "drops" the top order in front of
// the agent. Acting on it (any transition, or Skip) removes it locally and
// the next order slides into focus automatically — no manual re-pick.
//
// The queue is a SNAPSHOT taken once per session, not re-fetched after every
// action — re-fetching would reshuffle the list under the agent's feet
// (ties/tiers can reorder as other orders' states change) and undo a Skip.
// New leads that arrive mid-session show up via the manual "Refresh queue"
// action, which merges them in without losing current position.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] })
useHead({ title: 'Drop Queue — Call Center' })

const api = useAdminApi()
const { run } = useApiAction()

const queue = ref<AdminOrderListItem[]>([])
const loadingQueue = ref(false)

async function loadQueue() {
  loadingQueue.value = true
  const res = await api<{ items: AdminOrderListItem[]; total: number }>('/admin/orders/drop-queue', { query: { pageSize: 100 } })
  queue.value = res.items
  loadingQueue.value = false
}
await loadQueue()

type CallCenterStats = { Confirmed: number; CallCenterNoAnswer: number; WrongNumber: number; Postponed: number; Cancelled: number }
async function loadStats() {
  return api<CallCenterStats>('/admin/orders/call-center-stats')
}
const todayStats = await loadStats()

async function refreshQueue() {
  loadingQueue.value = true
  const [res, freshStats] = await Promise.all([
    api<{ items: AdminOrderListItem[]; total: number }>('/admin/orders/drop-queue', { query: { pageSize: 100 } }),
    loadStats()
  ])
  loadingQueue.value = false
  const existingIds = new Set(queue.value.map((o) => o.id))
  // Drop anything no longer in the fresh set (handled elsewhere, e.g. by
  // another agent) and append anything genuinely new, without touching the
  // order of what's already in the local queue — that's what keeps Skip's
  // "send to the back" reordering intact across a refresh.
  const freshIds = new Set(res.items.map((o) => o.id))
  const kept = queue.value.filter((o) => freshIds.has(o.id))
  const added = res.items.filter((o) => !existingIds.has(o.id))
  queue.value = [...kept, ...added]
  // Safe to just overwrite — the backend total already includes every
  // action this session took (they went through the same transition API),
  // so this only ever adds what a teammate did meanwhile, never loses
  // this session's own optimistic increments.
  Object.assign(stats, freshStats)
}

const current = computed(() => queue.value[0] ?? null)

// ---- Stats cards — seeded from today's REAL counts across the whole team
// (GET /admin/orders/call-center-stats, sourced from AuditLog — see
// AdminOrdersService.todayCallCenterStats). Previously this was a purely
// local counter that always started at 0 on page load, which read as
// "broken" to any agent opening the page after real activity had already
// happened earlier today (their own last session, or a teammate's).
// Actions taken in THIS session still increment on top of that seed
// immediately (optimistic — no refetch needed to see your own action
// reflected), so the numbers stay both real and responsive. `skipped` has
// no backend equivalent by design: Skip never calls the API (see skip()
// below), it's a local reordering, not a real state transition — nothing to
// seed it from.
const stats = reactive({
  Confirmed: todayStats.Confirmed,
  CallCenterNoAnswer: todayStats.CallCenterNoAnswer,
  WrongNumber: todayStats.WrongNumber,
  Postponed: todayStats.Postponed,
  Cancelled: todayStats.Cancelled,
  skipped: 0
})
const callsHandled = computed(() => stats.Confirmed + stats.CallCenterNoAnswer + stats.WrongNumber + stats.Postponed + stats.Cancelled)

// Queue composition — how many of each tier are left, so the agent can see
// the shape of the remaining work (e.g. "mostly retries left" vs "fresh
// leads waiting"). Abandoned orders are counted separately from their raw
// state (always PendingCallCenter — see OrdersService.createAbandonedOrder)
// rather than folded into "new": they're the lowest-priority tier in the
// actual queue ranking (see AdminOrdersService.dropQueue), so lumping them
// into "new" would overstate how many fresh, never-abandoned leads are
// actually waiting.
const composition = computed(() => {
  const c: Record<string, number> = { PendingCallCenter: 0, CallCenterNoAnswer: 0, Postponed: 0, WrongNumber: 0, Abandoned: 0 }
  for (const o of queue.value) {
    if (o.isAbandoned) c.Abandoned = (c.Abandoned ?? 0) + 1
    else if (o.state in c) c[o.state] = (c[o.state] ?? 0) + 1
  }
  return c
})

const acting = ref(false)
const actionLabel: Record<string, string> = {
  Confirmed: 'Order confirmed',
  CallCenterNoAnswer: 'Marked as no answer',
  WrongNumber: 'Marked as wrong number',
  Postponed: 'Order postponed',
  Cancelled: 'Order cancelled'
}

async function act(to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'Cancelled', postponedUntil?: string) {
  const order = current.value
  if (!order || acting.value) return
  acting.value = true
  const result = await run(
    () => api(`/admin/orders/${order.id}/transition`, { method: 'POST', body: { to, ...(postponedUntil && { postponedUntil }) } }),
    { success: actionLabel[to], errorFallback: 'Could not update the order' }
  )
  acting.value = false
  if (result === undefined) return
  if (to === 'Confirmed') stats.Confirmed++
  else stats[to]++
  queue.value = queue.value.filter((o) => o.id !== order.id)
}

// Postponing now requires picking a follow-up date/time — the order stays
// hidden from this queue until it's reached (see AdminOrdersService.
// dropQueue). A plain "Postpone" click used to instantly re-hide-then-
// immediately-reshow the same order, which is why it needed this gate at
// all: without a real date, "postponed" and "no answer" were functionally
// identical.
const postponeModalOpen = ref(false)
const postponeDate = ref('')
function openPostpone() {
  if (!current.value) return
  // Default to 4 hours from now — a reasonable "try again later today"
  // starting point the agent can just confirm or adjust, rather than an
  // empty field with no anchor.
  const d = new Date(Date.now() + 4 * 3600 * 1000)
  d.setSeconds(0, 0)
  postponeDate.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  postponeModalOpen.value = true
}
async function confirmPostpone() {
  if (!postponeDate.value) return
  const iso = new Date(postponeDate.value).toISOString()
  postponeModalOpen.value = false
  await act('Postponed', iso)
}

function skip() {
  const order = current.value
  if (!order) return
  stats.skipped++
  queue.value = [...queue.value.slice(1), order]
}

// ---- Call-center price override (ADM-12) — the drop queue is entirely
// pre-confirmation orders by construction (see dropQueue's state filter), so
// unlike orders/[id].vue this button never needs a state check to decide
// whether to render.
const priceModalOpen = ref(false)
const editShippingDzd = ref<number | null>(null)
const editTotalDzd = ref<number | null>(null)
const savingPrice = ref(false)

function openPriceEditor() {
  if (!current.value) return
  editShippingDzd.value = current.value.shippingPriceCents / 100
  editTotalDzd.value = current.value.totalCents / 100
  priceModalOpen.value = true
}

async function savePrice() {
  const order = current.value
  if (!order || editShippingDzd.value == null || editTotalDzd.value == null) return
  const shippingCents = Math.round(editShippingDzd.value * 100)
  const totalCents = Math.round(editTotalDzd.value * 100)
  savingPrice.value = true
  const body: { shippingPriceCents?: number; totalCents?: number } = {}
  if (shippingCents !== order.shippingPriceCents) body.shippingPriceCents = shippingCents
  if (totalCents !== order.totalCents) body.totalCents = totalCents
  if (Object.keys(body).length === 0) {
    savingPrice.value = false
    priceModalOpen.value = false
    return
  }
  const result = await run(() => api(`/admin/orders/${order.id}/price`, { method: 'PATCH', body }), {
    success: 'Price updated',
    errorFallback: 'Could not update the price'
  })
  savingPrice.value = false
  if (result === undefined) return
  priceModalOpen.value = false
  const updated = queue.value.find((o) => o.id === order.id)
  if (updated) {
    updated.shippingPriceCents = shippingCents
    updated.totalCents = totalCents
  }
}

// ---- Customer/address/shipping-method correction (ADM-14) — same
// pre-confirmation scope as price editing (the drop queue is entirely
// pre-confirmation orders by construction, so no state check needed here
// either). Wilaya/commune are edited via the same cascading selects the
// storefront checkout uses (GET /wilayas, GET /communes?wilayaId=) rather
// than free text, so a corrected address stays consistent with the real
// Algeria reference data — Address itself only stores plain name strings
// (see Address's Prisma comment), not a wilayaId/communeId FK, so the
// select's *name* is what actually gets sent, the id is only used locally
// to drive the commune fetch.
interface WilayaOption { id: string; name: string }
interface CommuneOption { id: string; name: string; wilayaId: string }
const wilayaOptions = ref<WilayaOption[]>([])
const communeOptions = ref<CommuneOption[]>([])
const wilayaOptionsLoaded = ref(false)
async function ensureWilayas() {
  if (wilayaOptionsLoaded.value) return
  wilayaOptionsLoaded.value = true
  wilayaOptions.value = await api<WilayaOption[]>('/wilayas')
}

const customerModalOpen = ref(false)
const editCustomerName = ref('')
const editCustomerPhone = ref('')
const editWilayaId = ref<string | undefined>(undefined)
const editCommuneName = ref('')
const editAddressLine1 = ref('')
const editShippingType = ref<'Home' | 'Desk' | undefined>(undefined)
const savingCustomer = ref(false)

async function openCustomerEditor() {
  const order = current.value
  if (!order) return
  await ensureWilayas()
  editCustomerName.value = order.customer.name ?? ''
  editCustomerPhone.value = formatPhoneLocal(order.customer.phone)
  editAddressLine1.value = order.address.line1
  editCommuneName.value = order.address.city
  editShippingType.value = order.shippingType ?? undefined
  const matchedWilaya = wilayaOptions.value.find((w) => w.name === order.address.region)
  editWilayaId.value = matchedWilaya?.id ?? undefined
  if (editWilayaId.value) await loadCommunes(editWilayaId.value)
  customerModalOpen.value = true
}

async function loadCommunes(wilayaId: string) {
  communeOptions.value = await api<CommuneOption[]>('/communes', { query: { wilayaId } })
}
watch(editWilayaId, (id, oldId) => {
  if (id && id !== oldId) {
    editCommuneName.value = ''
    loadCommunes(id)
  }
})

async function saveCustomer() {
  const order = current.value
  if (!order) return
  const wilayaName = wilayaOptions.value.find((w) => w.id === editWilayaId.value)?.name
  savingCustomer.value = true
  const body: Record<string, string> = {}
  if (editCustomerName.value.trim() !== (order.customer.name ?? '')) body.customerName = editCustomerName.value.trim()
  if (editCustomerPhone.value.trim() && editCustomerPhone.value.trim() !== formatPhoneLocal(order.customer.phone)) body.customerPhone = editCustomerPhone.value.trim()
  if (wilayaName && wilayaName !== order.address.region) body.wilaya = wilayaName
  if (editCommuneName.value && editCommuneName.value !== order.address.city) body.commune = editCommuneName.value
  if (editAddressLine1.value.trim() && editAddressLine1.value.trim() !== order.address.line1) body.addressLine1 = editAddressLine1.value.trim()
  if (editShippingType.value && editShippingType.value !== order.shippingType) body.shippingType = editShippingType.value
  if (Object.keys(body).length === 0) {
    savingCustomer.value = false
    customerModalOpen.value = false
    return
  }
  const result = await run(() => api(`/admin/orders/${order.id}/customer-info`, { method: 'PATCH', body }), {
    success: 'Customer info updated',
    errorFallback: 'Could not update customer info'
  })
  savingCustomer.value = false
  if (result === undefined) return
  customerModalOpen.value = false
  const updated = queue.value.find((o) => o.id === order.id)
  if (updated) {
    if (body.customerName !== undefined) updated.customer.name = body.customerName
    if (body.customerPhone !== undefined) updated.customer.phone = body.customerPhone
    if (body.wilaya !== undefined) updated.address.region = body.wilaya
    if (body.commune !== undefined) updated.address.city = body.commune
    if (body.addressLine1 !== undefined) updated.address.line1 = body.addressLine1
    if (body.shippingType !== undefined) updated.shippingType = body.shippingType as 'Home' | 'Desk'
  }
}

// ---- Call-center notes — same pattern as call-center/index.vue.
const notesModalOpen = ref(false)
const notesText = ref('')
const savingNotes = ref(false)

function openNotes() {
  if (!current.value) return
  notesText.value = current.value.notes ?? ''
  notesModalOpen.value = true
}

async function saveNotes() {
  const order = current.value
  if (!order) return
  savingNotes.value = true
  const result = await run(
    () => api(`/admin/orders/${order.id}/notes`, { method: 'PATCH', body: { notes: notesText.value.trim() || null } }),
    { success: 'Notes saved', errorFallback: 'Could not save notes' }
  )
  savingNotes.value = false
  if (result !== undefined) {
    notesModalOpen.value = false
    const updated = queue.value.find((o) => o.id === order.id)
    if (updated) updated.notes = notesText.value.trim() || null
  }
}

// ---- Keyboard shortcuts for hands-off-mouse speed. Ignored while a text
// field/textarea has focus (notes modal, or any future input) so typing "1"
// into a note doesn't accidentally confirm the order.
function isTyping(): boolean {
  const tag = document.activeElement?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA'
}
function onKeydown(e: KeyboardEvent) {
  if (isTyping() || acting.value || !current.value) return
  switch (e.key) {
    case '1': act('Confirmed'); break
    case '2': act('CallCenterNoAnswer'); break
    case '3': act('WrongNumber'); break
    case '4': openPostpone(); break
    case '5': act('Cancelled'); break
    case 's': case 'S': skip(); break
    case 'n': case 'N': openNotes(); break
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function addressLine(o: AdminOrderListItem) {
  return `${o.address.line1}, ${o.address.city}, ${o.address.region}`
}

// Time-in-queue badge, colored by age — a plain createdAt timestamp doesn't
// convey urgency at a glance the way a colored "waiting 6h" chip does.
function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
function ageColor(iso: string): 'success' | 'warning' | 'error' {
  const hours = (Date.now() - new Date(iso).getTime()) / 3600000
  if (hours < 1) return 'success'
  if (hours < 4) return 'warning'
  return 'error'
}

const tierLabel: Record<string, string> = {
  PendingCallCenter: 'New lead',
  CallCenterNoAnswer: 'Retry — no answer',
  Postponed: 'Postponed follow-up',
  WrongNumber: 'Wrong number'
}
</script>

<template>
  <AdsPage title="Drop queue" description="Work through orders one at a time">
    <template #actions>
      <span class="pill neutral">{{ queue.length }} left</span>
      <NuxtLink to="/call-center" class="btn"><AdsIcon name="i-lucide-list" />Back to queues</NuxtLink>
      <button class="btn" type="button" :disabled="loadingQueue" @click="refreshQueue"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </template>

    <div class="stack" style="width: 100%; max-width: 720px; margin: 0 auto">
      <!-- Today's real stats (whole team, from AuditLog) + this session's own actions layered on top optimistically. -->
      <section class="kpis" aria-label="Today" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))">
        <AdsKpiCard label="Handled" :value="callsHandled" color="dark" />
        <AdsKpiCard label="Confirmed" :value="stats.Confirmed" />
        <AdsKpiCard label="No answer" :value="stats.CallCenterNoAnswer" color="warning" />
        <AdsKpiCard label="Wrong #" :value="stats.WrongNumber" color="error" />
        <AdsKpiCard label="Postponed" :value="stats.Postponed" />
        <AdsKpiCard label="Skipped" :value="stats.skipped" />
      </section>

      <!-- Queue composition -->
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <span class="muted">Remaining</span>
        <span class="pill shipping">{{ composition.PendingCallCenter }} new</span>
        <span class="pill new">{{ composition.CallCenterNoAnswer }} retry</span>
        <span class="pill neutral">{{ composition.Postponed }} postponed</span>
        <span class="pill returned">{{ composition.WrongNumber }} wrong #</span>
        <span class="pill outline" title="Customer never finished submitting — lowest priority, but confirming one converts it to a normal order.">{{ composition.Abandoned }} abandoned</span>
      </div>

      <!-- Focus card -->
      <section v-if="!current" class="card" aria-label="Queue cleared">
        <div class="empty" style="padding: 60px 20px">
          <AdsIcon name="i-lucide-party-popper" style="width: 32px; height: 32px; color: var(--teal); display: block; margin: 0 auto" />
          <h2 style="font-size: 18px; margin-top: 10px; color: var(--pine)">Queue cleared</h2>
          <p>Every order in the drop queue has been handled. Nice work.</p>
        </div>
      </section>
      <section v-else class="card" aria-label="Current order">
        <div v-if="current.isDuplicate" class="notice danger"><AdsIcon name="i-lucide-alert-triangle" /><span>Possible duplicate — same customer + product within the last 2 days.</span></div>

        <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px">
          <div style="min-width: 0; flex: 1 1 280px">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
              <NuxtLink :to="`/orders/${current.id}`" class="link-cell">#{{ current.id.slice(0, 8) }}</NuxtLink>
              <span class="pill neutral">{{ tierLabel[current.state] }}</span>
              <span v-if="current.isAbandoned" class="pill outline" title="Customer never finished submitting — lowest priority in this queue, but confirming it converts it to a normal order.">Abandoned cart</span>
              <AdsBadge :color="ageColor(current.createdAt)" variant="subtle">waiting {{ ageLabel(current.createdAt) }}</AdsBadge>
            </div>
            <h2 style="font-size: 20px; margin-top: 8px">{{ current.customer.name ?? 'No name given' }}</h2>
            <!-- href keeps the full E.164 number (dialable regardless of device locale); the visible text is the local 0xxxxxxxxx form. -->
            <a :href="`tel:${current.customer.phone}`" class="phone-big mono" style="display: inline-flex; align-items: center; gap: 8px; color: var(--pine); text-decoration: none">
              <AdsIcon name="i-lucide-phone-call" style="width: 18px; height: 18px" />{{ formatPhoneLocal(current.customer.phone) }}
            </a>
            <p class="muted" style="margin-top: 4px">
              {{ addressLine(current) }}
              <button class="btn btn-ghost btn-sm" type="button" @click="openCustomerEditor"><AdsIcon name="i-lucide-pencil" />Edit</button>
            </p>
          </div>
          <div style="text-align: right">
            <AdsPrice :amount-cents="current.totalCents" class="strong" style="font-size: 22px" />
            <div><button class="btn btn-ghost btn-sm" type="button" @click="openPriceEditor"><AdsIcon name="i-lucide-pencil" />Edit price</button></div>
          </div>
        </div>

        <OrderLineItemsInline :items="current.items" />

        <div v-if="current.notes" class="notice warn"><AdsIcon name="i-lucide-sticky-note" /><span>{{ current.notes }}</span></div>

        <!-- Confirm gets its own full-width row so the hierarchy reads clearly on a phone. -->
        <AdsButton icon="i-lucide-check" block :loading="acting" label="Confirm order" @click="act('Confirmed')" />
        <div class="outcomes" role="group" aria-label="Call result" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))">
          <button class="outcome" type="button" :disabled="acting" @click="act('CallCenterNoAnswer')"><AdsIcon name="i-lucide-phone-missed" />No answer</button>
          <button class="outcome" type="button" :disabled="acting" @click="act('WrongNumber')"><AdsIcon name="i-lucide-phone-off" />Wrong number</button>
          <button class="outcome" type="button" :disabled="acting" @click="openPostpone"><AdsIcon name="i-lucide-calendar-clock" />Postpone</button>
          <button class="outcome bad" type="button" :disabled="acting" @click="act('Cancelled')"><AdsIcon name="i-lucide-x" />Cancel</button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px">
          <button class="btn btn-sm" type="button" @click="openNotes"><AdsIcon name="i-lucide-sticky-note" />{{ current.notes ? 'Edit note' : 'Add note' }}</button>
          <button class="btn btn-sm" type="button" @click="skip"><AdsIcon name="i-lucide-skip-forward" />Skip for now</button>
        </div>
      </section>

      <!-- Keyboard shortcuts only mean anything with a physical keyboard. -->
      <p class="muted hide-sm" style="text-align: center">Keyboard: 1 confirm · 2 no answer · 3 wrong number · 4 postpone · 5 cancel · S skip · N note</p>
    </div>
  </AdsPage>

  <AdsDialog v-model:open="notesModalOpen" title="Call-center note" width="sm">
    <AdsTextarea v-model="notesText" :rows="5" placeholder="Notes for this order…" autofocus />
    <template #footer>
      <button class="btn" type="button" @click="notesModalOpen = false">Cancel</button>
      <AdsButton :loading="savingNotes" icon="i-lucide-check" @click="saveNotes">Save</AdsButton>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="priceModalOpen" title="Edit price / shipping fee" width="sm">
    <AdsField label="Shipping fee (DZD)"><AdsNumberInput v-model="editShippingDzd" :min="0" /></AdsField>
    <AdsField label="Total due — COD (DZD)" help="Overrides the total directly; the items subtotal itself isn't editable here."><AdsNumberInput v-model="editTotalDzd" :min="0" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="priceModalOpen = false">Cancel</button>
      <AdsButton :loading="savingPrice" icon="i-lucide-check" @click="savePrice">Save</AdsButton>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="postponeModalOpen" title="Postpone — pick a follow-up date" description="The order stays out of the drop queue until this date/time is reached." width="sm">
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="postponeModalOpen = false">Cancel</button>
      <AdsButton :disabled="!postponeDate" :loading="acting" icon="i-lucide-check" @click="confirmPostpone">Postpone</AdsButton>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="customerModalOpen" title="Edit customer / delivery info">
    <div class="grid-2">
      <AdsField label="Name"><AdsInput v-model="editCustomerName" /></AdsField>
      <AdsField label="Phone"><AdsInput v-model="editCustomerPhone" /></AdsField>
    </div>
    <div class="grid-2">
      <AdsField label="Wilaya">
        <AdsSelect v-model="editWilayaId" :items="wilayaOptions.map((w) => ({ label: w.name, value: w.id }))" value-key="value" />
      </AdsField>
      <AdsField label="Commune">
        <AdsSelect v-model="editCommuneName" :items="communeOptions.map((c) => ({ label: c.name, value: c.name }))" value-key="value" :disabled="!editWilayaId" />
      </AdsField>
    </div>
    <AdsField label="Address line"><AdsInput v-model="editAddressLine1" /></AdsField>
    <AdsField label="Shipping method">
      <AdsRadioGroup v-model="editShippingType" orientation="horizontal" :items="[{ label: 'Home delivery', value: 'Home' }, { label: 'Desk pickup', value: 'Desk' }]" />
    </AdsField>
    <template #footer>
      <button class="btn" type="button" @click="customerModalOpen = false">Cancel</button>
      <AdsButton :loading="savingCustomer" icon="i-lucide-check" @click="saveCustomer">Save</AdsButton>
    </template>
  </AdsDialog>
</template>
