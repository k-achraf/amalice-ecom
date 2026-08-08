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
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Drop Queue">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #trailing>
          <UBadge color="neutral" variant="subtle">{{ queue.length }} left</UBadge>
        </template>
        <template #right>
          <UButton to="/call-center" icon="i-lucide-list" size="sm" color="neutral" variant="outline" aria-label="Back to queues">
            <span class="hidden sm:inline">Back to queues</span>
          </UButton>
          <UButton icon="i-lucide-refresh-cw" size="sm" color="neutral" variant="outline" :loading="loadingQueue" aria-label="Refresh queue" @click="refreshQueue">
            <span class="hidden sm:inline">Refresh queue</span>
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- w-full + min-w-0 are both load-bearing here, not decorative:
           this div is a flex item of DashboardPanel's body slot (flex
           flex-col). `mx-auto` sets auto margins on the cross axis, which
           per the flexbox spec DISABLES align-items:stretch for this item —
           so instead of being sized to the container's width, it falls back
           to shrink-to-fit sizing off its own content, and a long customer
           name/address/product name pushes it past the viewport. It was
           rendering ~500px wide inside a 375px viewport, silently clipped
           (no scrollbar — content just invisible) rather than wrapping.
           `w-full` gives it an explicit width so stretch no longer needs to
           apply; `min-w-0` is the belt-and-suspenders fix for the same
           default-min-width:auto issue on any nested flex/grid descendant. -->
      <div class="mx-auto w-full min-w-0 max-w-2xl space-y-5">
        <!-- Today's real stats (whole team, from AuditLog) + this session's
             own actions layered on top optimistically — see the `stats`
             comment in the script. -->
        <p class="text-xs text-muted">Today</p>
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-highlighted">{{ callsHandled }}</p>
            <p class="text-xs text-muted">Handled</p>
          </div>
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-success">{{ stats.Confirmed }}</p>
            <p class="text-xs text-muted">Confirmed</p>
          </div>
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-warning">{{ stats.CallCenterNoAnswer }}</p>
            <p class="text-xs text-muted">No answer</p>
          </div>
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-error">{{ stats.WrongNumber }}</p>
            <p class="text-xs text-muted">Wrong #</p>
          </div>
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-highlighted">{{ stats.Postponed }}</p>
            <p class="text-xs text-muted">Postponed</p>
          </div>
          <div class="admin-kpi-card p-3 text-center">
            <p class="tabular text-xl font-semibold text-muted">{{ stats.skipped }}</p>
            <p class="text-xs text-muted">Skipped</p>
          </div>
        </div>

        <!-- Queue composition -->
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Remaining:</span>
          <UBadge color="primary" variant="subtle">{{ composition.PendingCallCenter }} new</UBadge>
          <UBadge color="warning" variant="subtle">{{ composition.CallCenterNoAnswer }} retry</UBadge>
          <UBadge color="neutral" variant="subtle">{{ composition.Postponed }} postponed</UBadge>
          <UBadge color="error" variant="subtle">{{ composition.WrongNumber }} wrong #</UBadge>
          <UBadge color="neutral" variant="outline" title="Customer never finished submitting — lowest priority, but confirming one converts it to a normal order.">{{ composition.Abandoned }} abandoned</UBadge>
        </div>

        <!-- Focus card -->
        <EmptyState
          v-if="!current"
          icon="i-lucide-party-popper"
          title="Queue cleared"
          description="Every order in the drop queue has been handled. Nice work."
        />
        <div v-else class="admin-kpi-card space-y-4 p-4 sm:p-6">
          <div v-if="current.isDuplicate" class="flex items-center gap-2 rounded-md bg-error/10 px-3 py-2 text-sm text-error">
            <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
            Possible duplicate — same customer + product within the last 2 days.
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink :to="`/orders/${current.id}`" class="tabular font-medium text-primary hover:underline">{{ current.id.slice(0, 8) }}</NuxtLink>
                <UBadge color="neutral" variant="subtle" size="sm">{{ tierLabel[current.state] }}</UBadge>
                <UBadge v-if="current.isAbandoned" color="neutral" variant="outline" size="sm" title="Customer never finished submitting — lowest priority in this queue, but confirming it converts it to a normal order.">Abandoned cart</UBadge>
                <UBadge :color="ageColor(current.createdAt)" variant="subtle" size="sm">waiting {{ ageLabel(current.createdAt) }}</UBadge>
              </div>
              <p class="mt-1 text-lg font-semibold text-highlighted">{{ current.customer.name ?? 'No name given' }}</p>
              <!-- href keeps the full E.164 number (dialable regardless of
                   device locale); the visible text is the local 0xxxxxxxxx
                   form every agent expects, whatever format it was captured
                   in (+213/213/0/bare 9-digit) — see formatPhoneLocal. -->
              <a :href="`tel:${current.customer.phone}`" class="tabular mt-0.5 flex items-center gap-1.5 text-lg text-primary hover:underline">
                <UIcon name="i-lucide-phone-call" class="size-4 shrink-0" />{{ formatPhoneLocal(current.customer.phone) }}
              </a>
              <p class="mt-1 text-sm text-muted">
                {{ addressLine(current) }}
                <UButton icon="i-lucide-pencil" size="xs" variant="link" color="neutral" label="Edit" @click="openCustomerEditor" />
              </p>
            </div>
            <div class="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:text-right">
              <PriceDisplay :amount-cents="current.totalCents" class="tabular text-xl font-semibold text-highlighted" />
              <UButton icon="i-lucide-pencil" size="xs" variant="link" color="neutral" label="Edit price" @click="openPriceEditor" />
            </div>
          </div>

          <OrderLineItemsInline :items="current.items" />

          <div v-if="current.notes" class="flex items-start gap-1.5 rounded-md bg-elevated px-3 py-2 text-sm text-muted">
            <UIcon name="i-lucide-sticky-note" class="mt-0.5 size-3.5 shrink-0" />{{ current.notes }}
          </div>

          <!-- Actions — primary (Confirm) gets its own full-width row so the
               hierarchy reads clearly on a phone instead of 6 equal-weight
               buttons in a cramped grid; secondary outcomes and utility
               actions (note/skip) are their own smaller groups below. Numeric
               "(1)"/"(2)" keyboard hints live only in the legend text below,
               not baked into each label — those hints are meaningless on a
               phone with no physical keyboard and were what made the 2-col
               mobile grid overflow ("Wrong number (3)" etc. never fit). -->
          <UButton icon="i-lucide-check" color="primary" size="lg" block :loading="acting" label="Confirm order" @click="act('Confirmed')" />
          <div class="grid grid-cols-2 gap-2">
            <UButton icon="i-lucide-phone-missed" color="warning" variant="outline" :loading="acting" label="No answer" @click="act('CallCenterNoAnswer')" />
            <UButton icon="i-lucide-phone-off" color="error" variant="outline" :loading="acting" label="Wrong number" @click="act('WrongNumber')" />
            <UButton icon="i-lucide-calendar-clock" color="warning" variant="outline" :loading="acting" label="Postpone" @click="openPostpone" />
            <UButton icon="i-lucide-x" color="error" variant="outline" :loading="acting" label="Cancel" @click="act('Cancelled')" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UButton icon="i-lucide-sticky-note" color="neutral" variant="ghost" :label="current.notes ? 'Edit note' : 'Add note'" @click="openNotes" />
            <UButton icon="i-lucide-skip-forward" color="neutral" variant="soft" label="Skip for now" @click="skip" />
          </div>
        </div>

        <!-- Keyboard shortcuts only mean anything with a physical keyboard —
             hidden on mobile instead of a legend nobody on a phone can use. -->
        <p class="hidden text-center text-xs text-muted sm:block">Keyboard: 1 confirm · 2 no answer · 3 wrong number · 4 postpone · 5 cancel · S skip · N note</p>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="notesModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Call-center note</h3>
        <UTextarea v-model="notesText" :rows="5" placeholder="Notes for this order…" class="w-full" autofocus />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="notesModalOpen = false">Cancel</UButton>
          <UButton :loading="savingNotes" color="primary" icon="i-lucide-check" @click="saveNotes">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="priceModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Edit price / shipping fee</h3>
        <UFormField label="Shipping fee (DZD)">
          <UInputNumber v-model="editShippingDzd" :min="0" class="w-full" />
        </UFormField>
        <UFormField label="Total due — COD (DZD)" help="Overrides the total directly; the items subtotal itself isn't editable here.">
          <UInputNumber v-model="editTotalDzd" :min="0" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="priceModalOpen = false">Cancel</UButton>
          <UButton :loading="savingPrice" color="primary" icon="i-lucide-check" @click="savePrice">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="postponeModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Postpone — pick a follow-up date</h3>
        <p class="text-sm text-muted">The order stays out of the Drop Queue until this date/time is reached.</p>
        <UFormField label="Follow up at">
          <UInput v-model="postponeDate" type="datetime-local" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="postponeModalOpen = false">Cancel</UButton>
          <UButton :disabled="!postponeDate" :loading="acting" color="primary" icon="i-lucide-check" @click="confirmPostpone">Postpone</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="customerModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Edit customer / delivery info</h3>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Name">
            <UInput v-model="editCustomerName" class="w-full" />
          </UFormField>
          <UFormField label="Phone">
            <UInput v-model="editCustomerPhone" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Wilaya">
            <USelectMenu
              v-model="editWilayaId"
              :items="wilayaOptions.map(w => ({ label: w.name, value: w.id }))"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Commune">
            <USelectMenu
              v-model="editCommuneName"
              :items="communeOptions.map(c => ({ label: c.name, value: c.name }))"
              value-key="value"
              :disabled="!editWilayaId"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Address line">
          <UInput v-model="editAddressLine1" class="w-full" />
        </UFormField>
        <UFormField label="Shipping method">
          <URadioGroup
            v-model="editShippingType"
            orientation="horizontal"
            :items="[{ label: 'Home delivery', value: 'Home' }, { label: 'Desk pickup', value: 'Desk' }]"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="customerModalOpen = false">Cancel</UButton>
          <UButton :loading="savingCustomer" color="primary" icon="i-lucide-check" @click="saveCustomer">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
