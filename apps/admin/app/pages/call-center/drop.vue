<script setup lang="ts">
import type { AdminOrderListItem } from '@amalice/shared'

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
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support'] })
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

async function refreshQueue() {
  loadingQueue.value = true
  const res = await api<{ items: AdminOrderListItem[]; total: number }>('/admin/orders/drop-queue', { query: { pageSize: 100 } })
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
}

const current = computed(() => queue.value[0] ?? null)

// ---- Session stats — purely local, resets on page reload. Gives the agent
// a sense of momentum during a shift without needing a separate reporting
// page for it.
const stats = reactive({ Confirmed: 0, CallCenterNoAnswer: 0, WrongNumber: 0, Postponed: 0, Cancelled: 0, skipped: 0 })
const callsHandled = computed(() => stats.Confirmed + stats.CallCenterNoAnswer + stats.WrongNumber + stats.Postponed + stats.Cancelled)

// Queue composition — how many of each tier are left, so the agent can see
// the shape of the remaining work (e.g. "mostly retries left" vs "fresh
// leads waiting").
const composition = computed(() => {
  const c: Record<string, number> = { PendingCallCenter: 0, CallCenterNoAnswer: 0, Postponed: 0, WrongNumber: 0 }
  for (const o of queue.value) if (o.state in c) c[o.state] = (c[o.state] ?? 0) + 1
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

async function act(to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'Cancelled') {
  const order = current.value
  if (!order || acting.value) return
  acting.value = true
  const result = await run(() => api(`/admin/orders/${order.id}/transition`, { method: 'POST', body: { to } }), {
    success: actionLabel[to],
    errorFallback: 'Could not update the order'
  })
  acting.value = false
  if (result === undefined) return
  if (to === 'Confirmed') stats.Confirmed++
  else stats[to]++
  queue.value = queue.value.filter((o) => o.id !== order.id)
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
    case '4': act('Postponed'); break
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
          <UButton to="/call-center" icon="i-lucide-list" size="sm" color="neutral" variant="outline" label="Back to queues" />
          <UButton icon="i-lucide-refresh-cw" size="sm" color="neutral" variant="outline" :loading="loadingQueue" label="Refresh queue" @click="refreshQueue" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-2xl space-y-5">
        <!-- Session stats -->
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
        </div>

        <!-- Focus card -->
        <EmptyState
          v-if="!current"
          icon="i-lucide-party-popper"
          title="Queue cleared"
          description="Every order in the drop queue has been handled. Nice work."
        />
        <div v-else class="admin-kpi-card space-y-4 p-6">
          <div v-if="current.isDuplicate" class="flex items-center gap-2 rounded-md bg-error/10 px-3 py-2 text-sm text-error">
            <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
            Possible duplicate — same customer + product within the last 2 days.
          </div>

          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink :to="`/orders/${current.id}`" class="tabular font-medium text-primary hover:underline">{{ current.id.slice(0, 8) }}</NuxtLink>
                <UBadge color="neutral" variant="subtle" size="sm">{{ tierLabel[current.state] }}</UBadge>
                <UBadge :color="ageColor(current.createdAt)" variant="subtle" size="sm">waiting {{ ageLabel(current.createdAt) }}</UBadge>
              </div>
              <p class="mt-1 text-lg font-semibold text-highlighted">{{ current.customer.name ?? 'No name given' }}</p>
              <a :href="`tel:${current.customer.phone}`" class="tabular mt-0.5 flex items-center gap-1.5 text-lg text-primary hover:underline">
                <UIcon name="i-lucide-phone-call" class="size-4" />{{ current.customer.phone }}
              </a>
              <p class="mt-1 text-sm text-muted">{{ addressLine(current) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <PriceDisplay :amount-cents="current.totalCents" class="tabular text-xl font-semibold text-highlighted" />
              <UButton icon="i-lucide-pencil" size="xs" variant="link" color="neutral" label="Edit price" @click="openPriceEditor" />
            </div>
          </div>

          <OrderLineItemsInline :items="current.items" />

          <div v-if="current.notes" class="flex items-start gap-1.5 rounded-md bg-elevated px-3 py-2 text-sm text-muted">
            <UIcon name="i-lucide-sticky-note" class="mt-0.5 size-3.5 shrink-0" />{{ current.notes }}
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <UButton icon="i-lucide-check" color="primary" :loading="acting" label="Confirm (1)" @click="act('Confirmed')" />
            <UButton icon="i-lucide-phone-missed" color="warning" variant="outline" :loading="acting" label="No answer (2)" @click="act('CallCenterNoAnswer')" />
            <UButton icon="i-lucide-phone-off" color="error" variant="outline" :loading="acting" label="Wrong number (3)" @click="act('WrongNumber')" />
            <UButton icon="i-lucide-calendar-clock" color="warning" variant="outline" :loading="acting" label="Postpone (4)" @click="act('Postponed')" />
            <UButton icon="i-lucide-x" color="error" variant="outline" :loading="acting" label="Cancel (5)" @click="act('Cancelled')" />
            <UButton icon="i-lucide-sticky-note" color="neutral" variant="ghost" :label="current.notes ? 'Edit note (N)' : 'Add note (N)'" @click="openNotes" />
          </div>
          <UButton icon="i-lucide-skip-forward" color="neutral" variant="soft" block label="Skip — come back to this later (S)" @click="skip" />
        </div>

        <p class="text-center text-xs text-muted">Keyboard: 1 confirm · 2 no answer · 3 wrong number · 4 postpone · 5 cancel · S skip · N note</p>
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
</template>
