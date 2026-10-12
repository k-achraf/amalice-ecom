<script setup lang="ts">
import type { OrderListResponse } from '@amalice/shared'

// Orders auto-created when a customer typed a phone number on the Impulse
// lead form and went idle past the store's configured delay (Storefront
// settings) without submitting — see OrdersService.createAbandonedOrder.
// Kept off the main Orders/Call Center queues (admin-orders.service.ts's
// list() excludes isAbandoned by default) so they don't read as real
// confirmed leads; this page is where staff follow up on them specifically.
// Same transition actions as Call Center — an abandoned order starts in
// PendingCallCenter exactly like a real one.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support'] })
useHead({ title: 'Abandoned Carts' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: queue, pending, refresh } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?abandoned=only&pageSize=100',
  { key: 'admin-abandoned-carts' }
)

// Terminal states (Cancelled, or converted-away isAbandoned rows that
// completed) shouldn't clutter the follow-up queue — only show ones still
// worth a call.
const activeItems = computed(() => (queue.value?.items ?? []).filter((o) => o.state !== 'Cancelled'))

const acting = ref<string | null>(null)
const actionLabel: Record<string, string> = {
  Confirmed: 'Order confirmed',
  CallCenterNoAnswer: 'Marked as no answer',
  WrongNumber: 'Marked as wrong number',
  Postponed: 'Order postponed',
  Cancelled: 'Order cancelled'
}
async function act(orderId: string, to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'Cancelled', postponedUntil?: string) {
  acting.value = `${orderId}:${to}`
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to, postponedUntil } }), {
    success: actionLabel[to],
    errorFallback: 'Could not update the order'
  })
  await refresh()
  acting.value = null
}

// Postpone requires a follow-up date/time (server rejects a bare
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}

// ---- Design chrome: soft search, KPI figures ----
const search = ref('')
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return activeItems.value.filter((o) => !q || `${o.customer.name ?? ''} ${o.customer.phone}`.toLowerCase().includes(q))
})
const money = (cents: number) => Math.round(cents / 100).toLocaleString('en-US')
const totalCents = computed(() => activeItems.value.reduce((n, o) => n + o.items.reduce((m, i) => m + i.lineTotalCents, 0), 0))

</script>

<template>
  <AdsPage title="Abandoned carts" description="Visitors who started an order but didn't finish">
    <section class="kpis" aria-label="Recovery figures">
      <AdsKpiCard label="Abandoned carts" :value="activeItems.length" meta="Still worth a call" />
      <AdsKpiCard label="Value left in carts" :value="money(totalCents)" unit="DA" meta="Without delivery" />
      <AdsKpiCard label="With a phone number" :value="activeItems.filter((o) => o.customer.phone).length" color="dark" :meta="`of ${activeItems.length} carts`" />
    </section>

    <section class="card" aria-label="Carts">
      <div class="card-head">
        <h2>Carts to follow up</h2>
        <label class="search soft"><AdsIcon name="i-lucide-search" /><span class="sr">Search carts</span><input v-model="search" type="search" placeholder="Name or phone"></label>
      </div>
      <div class="table-wrap">
        <table style="min-width: 900px">
          <thead><tr><th>Customer</th><th>Products</th><th class="num">Value</th><th>Left at</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="6" class="empty">Loading…</td></tr>
            <tr v-else-if="!visible.length"><td colspan="6" class="empty">No abandoned carts. Every lead-form visitor who typed a phone number has either finished checking out or already been contacted.</td></tr>
            <tr v-for="o in visible" v-else :key="o.id">
              <td><span class="strong">{{ o.customer.name || 'No name given' }}</span><span class="sub">{{ o.customer.phone || 'No phone' }}<template v-if="o.address.region"> · {{ o.address.region }}</template></span></td>
              <td class="muted" style="max-width: 220px">{{ o.items.map((i) => `${i.product.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ') }}</td>
              <td class="num strong"><AdsPrice :amount-cents="o.items.reduce((n, i) => n + i.lineTotalCents, 0)" /></td>
              <td>{{ fmtDate(o.createdAt) }}<span class="sub"><NuxtLink :to="`/orders/${o.id}`">#{{ o.id.slice(0, 8) }}</NuxtLink></span></td>
              <td><AdsOrderStatus :state="o.state" /></td>
              <td class="num" style="white-space: nowrap">
                <a v-if="o.customer.phone" class="row-btn" :href="`tel:${o.customer.phone}`" :aria-label="`Call ${o.customer.name ?? o.customer.phone}`"><AdsIcon name="i-lucide-phone" /></a>
                <button class="btn btn-sm btn-primary" type="button" :disabled="acting === `${o.id}:Confirmed`" @click="act(o.id, 'Confirmed')">Confirm</button>
                <button class="btn btn-sm" type="button" :disabled="acting === `${o.id}:CallCenterNoAnswer`" @click="act(o.id, 'CallCenterNoAnswer')">No answer</button>
                <button class="btn btn-sm" type="button" :disabled="acting === `${o.id}:Postponed`" @click="openPostpone(o.id)">Postpone</button>
                <button class="btn btn-sm" type="button" :disabled="acting === `${o.id}:WrongNumber`" @click="act(o.id, 'WrongNumber')">Wrong number</button>
                <button class="btn btn-sm btn-danger" type="button" :disabled="acting === `${o.id}:Cancelled`" @click="act(o.id, 'Cancelled')">Cancel</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdsPage>

  <AdsDialog v-model:open="postponeModalOpen" title="Postpone: pick a follow-up date" description="The order stays out of the follow-up queue until this date/time is reached." width="sm">
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="postponeModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!postponeDate" @click="confirmPostpone">Postpone</button>
    </template>
  </AdsDialog>
</template>
